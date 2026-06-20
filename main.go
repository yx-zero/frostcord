package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	err := wails.Run(&options.App{
		Title:     "Frostcord",
		Width:     1280,
		Height:    832,
		MinWidth:  940,
		MinHeight: 600,
		// Frameless so our custom liquid-glass top bar + drag regions own the
		// chrome, Telegram-style.
		Frameless: true,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// Catppuccin Mocha crust as the window base color (matches default theme).
		BackgroundColour: &options.RGBA{R: 17, G: 17, B: 27, A: 1},
		Windows: &windows.Options{
			WebviewIsTransparent:              false,
			WindowIsTranslucent:               false,
			DisableFramelessWindowDecorations: false,
		},
		OnStartup: app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
