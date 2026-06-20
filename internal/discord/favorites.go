package discord

import (
	"encoding/base64"
	"fmt"
	"net/http"
	"sort"
)

// Favorite GIFs are stored server-side in the FRECENCY settings protobuf
// (GET /users/@me/settings-proto/2), so they sync across devices. We fetch the
// base64 protobuf and decode just the path we need:
//   FrecencyUserSettings.favorite_gifs (field 2)
//     -> FavoriteGIFs.gifs (field 1, map<string url, FavoriteGIF>)
//          -> FavoriteGIF { format=1, src=2, width=3, height=4, order=5 }
//
// To avoid a full protobuf codegen dependency we hand-decode the wire format
// for this single, stable shape.

type FavoriteGif struct {
	URL    string
	Src    string
	Format int
	Width  int
	Height int
	Order  int
}

// FavoriteGifs fetches and decodes the user's account-synced favorite GIFs,
// ordered by their saved order.
func (r *REST) FavoriteGifs() ([]FavoriteGif, error) {
	var resp struct {
		Settings string `json:"settings"`
	}
	if err := r.do(http.MethodGet, "/users/@me/settings-proto/2", nil, &resp); err != nil {
		return nil, err
	}
	if resp.Settings == "" {
		return nil, nil
	}
	raw, err := base64.StdEncoding.DecodeString(resp.Settings)
	if err != nil {
		// Discord may use URL-safe base64 in some cases.
		raw, err = base64.RawStdEncoding.DecodeString(resp.Settings)
		if err != nil {
			return nil, fmt.Errorf("decode settings proto: %w", err)
		}
	}

	gifs, err := parseFavoriteGifs(raw)
	if err != nil {
		return nil, err
	}
	sort.SliceStable(gifs, func(i, j int) bool { return gifs[i].Order < gifs[j].Order })
	return gifs, nil
}

// --- minimal protobuf wire reader -----------------------------------------

type pbReader struct {
	buf []byte
	pos int
}

func (p *pbReader) eof() bool { return p.pos >= len(p.buf) }

// readVarint reads a base-128 varint.
func (p *pbReader) readVarint() (uint64, error) {
	var x uint64
	var shift uint
	for {
		if p.pos >= len(p.buf) {
			return 0, fmt.Errorf("varint: unexpected EOF")
		}
		b := p.buf[p.pos]
		p.pos++
		x |= uint64(b&0x7f) << shift
		if b < 0x80 {
			return x, nil
		}
		shift += 7
		if shift >= 64 {
			return 0, fmt.Errorf("varint: too long")
		}
	}
}

// readTag returns the field number and wire type.
func (p *pbReader) readTag() (int, int, error) {
	v, err := p.readVarint()
	if err != nil {
		return 0, 0, err
	}
	return int(v >> 3), int(v & 0x7), nil
}

// readBytes reads a length-delimited byte slice.
func (p *pbReader) readBytes() ([]byte, error) {
	n, err := p.readVarint()
	if err != nil {
		return nil, err
	}
	if p.pos+int(n) > len(p.buf) {
		return nil, fmt.Errorf("bytes: out of range")
	}
	b := p.buf[p.pos : p.pos+int(n)]
	p.pos += int(n)
	return b, nil
}

// skip advances past a field of the given wire type.
func (p *pbReader) skip(wire int) error {
	switch wire {
	case 0: // varint
		_, err := p.readVarint()
		return err
	case 1: // 64-bit
		p.pos += 8
	case 2: // length-delimited
		_, err := p.readBytes()
		return err
	case 5: // 32-bit
		p.pos += 4
	default:
		return fmt.Errorf("unknown wire type %d", wire)
	}
	if p.pos > len(p.buf) {
		return fmt.Errorf("skip out of range")
	}
	return nil
}

// parseFavoriteGifs walks FrecencyUserSettings -> favorite_gifs(2) -> gifs(1).
func parseFavoriteGifs(data []byte) ([]FavoriteGif, error) {
	root := &pbReader{buf: data}
	for !root.eof() {
		field, wire, err := root.readTag()
		if err != nil {
			return nil, err
		}
		if field == 2 && wire == 2 {
			favBytes, err := root.readBytes()
			if err != nil {
				return nil, err
			}
			return parseFavoriteGIFs(favBytes)
		}
		if err := root.skip(wire); err != nil {
			return nil, err
		}
	}
	return nil, nil
}

// parseFavoriteGIFs walks the FavoriteGIFs message: gifs map entries (field 1).
func parseFavoriteGIFs(data []byte) ([]FavoriteGif, error) {
	r := &pbReader{buf: data}
	var out []FavoriteGif
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return nil, err
		}
		if field == 1 && wire == 2 {
			entry, err := r.readBytes()
			if err != nil {
				return nil, err
			}
			gif, err := parseGifMapEntry(entry)
			if err != nil {
				return nil, err
			}
			out = append(out, gif)
			continue
		}
		if err := r.skip(wire); err != nil {
			return nil, err
		}
	}
	return out, nil
}

// parseGifMapEntry decodes a map entry: key(1)=url string, value(2)=FavoriteGIF.
func parseGifMapEntry(data []byte) (FavoriteGif, error) {
	r := &pbReader{buf: data}
	var g FavoriteGif
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return g, err
		}
		switch {
		case field == 1 && wire == 2: // map key = url
			b, err := r.readBytes()
			if err != nil {
				return g, err
			}
			g.URL = string(b)
		case field == 2 && wire == 2: // map value = FavoriteGIF message
			b, err := r.readBytes()
			if err != nil {
				return g, err
			}
			if err := parseFavoriteGIF(b, &g); err != nil {
				return g, err
			}
		default:
			if err := r.skip(wire); err != nil {
				return g, err
			}
		}
	}
	return g, nil
}

// parseFavoriteGIF decodes the value message fields.
func parseFavoriteGIF(data []byte, g *FavoriteGif) error {
	r := &pbReader{buf: data}
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return err
		}
		switch {
		case field == 1 && wire == 0: // format enum
			v, err := r.readVarint()
			if err != nil {
				return err
			}
			g.Format = int(v)
		case field == 2 && wire == 2: // src
			b, err := r.readBytes()
			if err != nil {
				return err
			}
			g.Src = string(b)
		case field == 3 && wire == 0: // width
			v, err := r.readVarint()
			if err != nil {
				return err
			}
			g.Width = int(v)
		case field == 4 && wire == 0: // height
			v, err := r.readVarint()
			if err != nil {
				return err
			}
			g.Height = int(v)
		case field == 5 && wire == 0: // order
			v, err := r.readVarint()
			if err != nil {
				return err
			}
			g.Order = int(v)
		default:
			if err := r.skip(wire); err != nil {
				return err
			}
		}
	}
	return nil
}
