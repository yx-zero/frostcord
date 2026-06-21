package discord

import (
	"encoding/base64"
	"encoding/binary"
	"fmt"
	"net/http"
	"strconv"
)

// Guild sidebar order for user accounts lives in the PreloadedUserSettings
// protobuf (settings-proto type 1), not in READY. We fetch and decode:
//   PreloadedUserSettings.guild_folders (field 14)
//     -> GuildFolders.folders (field 1, repeated GuildFolder)
//          -> GuildFolder.guild_ids (field 1, repeated fixed64, packed)
//     -> GuildFolders.guild_positions (field 2, repeated fixed64) [fallback]

// GuildOrder fetches the user's real sidebar guild order (flattened).
func (r *REST) GuildOrder() ([]string, error) {
	var resp struct {
		Settings string `json:"settings"`
	}
	if err := r.do(http.MethodGet, "/users/@me/settings-proto/1", nil, &resp); err != nil {
		return nil, err
	}
	if resp.Settings == "" {
		return nil, nil
	}
	raw, err := base64.StdEncoding.DecodeString(resp.Settings)
	if err != nil {
		raw, err = base64.RawStdEncoding.DecodeString(resp.Settings)
		if err != nil {
			return nil, fmt.Errorf("decode preloaded settings: %w", err)
		}
	}
	return parseGuildOrder(raw)
}

// GuildFolderInfo is one sidebar entry: either a real folder (ID/Name set,
// holding multiple guilds) or a standalone guild (single GuildID, empty ID).
type GuildFolderInfo struct {
	ID       string
	Name     string
	Color    int
	GuildIDs []string
}

// GuildFolders fetches the user's sidebar folder structure (proto field 14),
// preserving folder grouping (unlike GuildOrder, which flattens it).
func (r *REST) GuildFolders() ([]GuildFolderInfo, error) {
	var resp struct {
		Settings string `json:"settings"`
	}
	if err := r.do(http.MethodGet, "/users/@me/settings-proto/1", nil, &resp); err != nil {
		return nil, err
	}
	if resp.Settings == "" {
		return nil, nil
	}
	raw, err := base64.StdEncoding.DecodeString(resp.Settings)
	if err != nil {
		raw, err = base64.RawStdEncoding.DecodeString(resp.Settings)
		if err != nil {
			return nil, fmt.Errorf("decode preloaded settings: %w", err)
		}
	}
	return parseFoldersStructured(raw)
}

// parseFoldersStructured walks PreloadedUserSettings -> guild_folders(14).
func parseFoldersStructured(data []byte) ([]GuildFolderInfo, error) {
	root := &pbReader{buf: data}
	for !root.eof() {
		field, wire, err := root.readTag()
		if err != nil {
			return nil, err
		}
		if field == 14 && wire == 2 {
			b, err := root.readBytes()
			if err != nil {
				return nil, err
			}
			return parseFolderList(b)
		}
		if err := root.skip(wire); err != nil {
			return nil, err
		}
	}
	return nil, nil
}

// parseFolderList walks GuildFolders.folders(1) into structured entries.
func parseFolderList(data []byte) ([]GuildFolderInfo, error) {
	r := &pbReader{buf: data}
	var folders []GuildFolderInfo
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return nil, err
		}
		if field == 1 && wire == 2 {
			b, err := r.readBytes()
			if err != nil {
				return nil, err
			}
			f, err := parseFolderEntry(b)
			if err != nil {
				return nil, err
			}
			folders = append(folders, f)
		} else if err := r.skip(wire); err != nil {
			return nil, err
		}
	}
	return folders, nil
}

// parseFolderEntry reads a GuildFolder: guild_ids(1), id(2), name(3), color(4).
// id/name/color are google.protobuf wrapper messages (value lives in field 1).
func parseFolderEntry(data []byte) (GuildFolderInfo, error) {
	r := &pbReader{buf: data}
	var f GuildFolderInfo
	var ids []uint64
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return f, err
		}
		switch {
		case field == 1 && wire == 2: // packed guild_ids
			b, err := r.readBytes()
			if err != nil {
				return f, err
			}
			ids = append(ids, readPackedFixed64(b)...)
		case field == 1 && wire == 1: // single guild_id
			v, err := r.readFixed64()
			if err != nil {
				return f, err
			}
			ids = append(ids, v)
		case field == 2 && wire == 2: // id (Int64Value)
			b, err := r.readBytes()
			if err != nil {
				return f, err
			}
			f.ID = strconv.FormatUint(wrapperVarint(b), 10)
		case field == 3 && wire == 2: // name (StringValue)
			b, err := r.readBytes()
			if err != nil {
				return f, err
			}
			f.Name = wrapperString(b)
		case field == 4 && wire == 2: // color (UInt64Value)
			b, err := r.readBytes()
			if err != nil {
				return f, err
			}
			f.Color = int(wrapperVarint(b))
		default:
			if err := r.skip(wire); err != nil {
				return f, err
			}
		}
	}
	f.GuildIDs = toStrings(ids)
	return f, nil
}

// wrapperVarint reads value(1) of a google.protobuf.{Int64,UInt64}Value message.
func wrapperVarint(data []byte) uint64 {
	r := &pbReader{buf: data}
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return 0
		}
		if field == 1 && wire == 0 {
			v, err := r.readVarint()
			if err != nil {
				return 0
			}
			return v
		}
		if err := r.skip(wire); err != nil {
			return 0
		}
	}
	return 0
}

// wrapperString reads value(1) of a google.protobuf.StringValue message.
func wrapperString(data []byte) string {
	r := &pbReader{buf: data}
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return ""
		}
		if field == 1 && wire == 2 {
			b, err := r.readBytes()
			if err != nil {
				return ""
			}
			return string(b)
		}
		if err := r.skip(wire); err != nil {
			return ""
		}
	}
	return ""
}

// readFixed64 reads a little-endian 64-bit value.
func (p *pbReader) readFixed64() (uint64, error) {
	if p.pos+8 > len(p.buf) {
		return 0, fmt.Errorf("fixed64: out of range")
	}
	v := binary.LittleEndian.Uint64(p.buf[p.pos : p.pos+8])
	p.pos += 8
	return v, nil
}

// readPackedFixed64 reads a length-delimited packed repeated fixed64 field.
func readPackedFixed64(data []byte) []uint64 {
	out := make([]uint64, 0, len(data)/8)
	for i := 0; i+8 <= len(data); i += 8 {
		out = append(out, binary.LittleEndian.Uint64(data[i:i+8]))
	}
	return out
}

// parseGuildOrder walks PreloadedUserSettings -> guild_folders(14).
func parseGuildOrder(data []byte) ([]string, error) {
	root := &pbReader{buf: data}
	for !root.eof() {
		field, wire, err := root.readTag()
		if err != nil {
			return nil, err
		}
		if field == 14 && wire == 2 {
			b, err := root.readBytes()
			if err != nil {
				return nil, err
			}
			return parseGuildFolders(b)
		}
		if err := root.skip(wire); err != nil {
			return nil, err
		}
	}
	return nil, nil
}

// parseGuildFolders walks GuildFolders: folders(1) then guild_positions(2).
func parseGuildFolders(data []byte) ([]string, error) {
	r := &pbReader{buf: data}
	var fromFolders []string
	var positions []uint64
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return nil, err
		}
		switch {
		case field == 1 && wire == 2: // a GuildFolder message
			b, err := r.readBytes()
			if err != nil {
				return nil, err
			}
			ids, err := parseGuildFolder(b)
			if err != nil {
				return nil, err
			}
			fromFolders = append(fromFolders, ids...)
		case field == 2 && wire == 2: // packed guild_positions (fixed64)
			b, err := r.readBytes()
			if err != nil {
				return nil, err
			}
			positions = append(positions, readPackedFixed64(b)...)
		default:
			if err := r.skip(wire); err != nil {
				return nil, err
			}
		}
	}
	if len(fromFolders) > 0 {
		return fromFolders, nil
	}
	return toStrings(positions), nil
}

// parseGuildFolder extracts guild_ids(1) — packed or unpacked fixed64.
func parseGuildFolder(data []byte) ([]string, error) {
	r := &pbReader{buf: data}
	var ids []uint64
	for !r.eof() {
		field, wire, err := r.readTag()
		if err != nil {
			return nil, err
		}
		switch {
		case field == 1 && wire == 2: // packed fixed64
			b, err := r.readBytes()
			if err != nil {
				return nil, err
			}
			ids = append(ids, readPackedFixed64(b)...)
		case field == 1 && wire == 1: // single fixed64 (unpacked)
			v, err := r.readFixed64()
			if err != nil {
				return nil, err
			}
			ids = append(ids, v)
		default:
			if err := r.skip(wire); err != nil {
				return nil, err
			}
		}
	}
	return toStrings(ids), nil
}

func toStrings(ids []uint64) []string {
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, strconv.FormatUint(id, 10))
	}
	return out
}
