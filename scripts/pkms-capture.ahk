; PKMS capture — Win+N anywhere → textbox already focused → vault/inbox/
; (build-plan slice 1; file format mirrors src/pkms/capture.py — keep in sync)
; Enter = save · Shift+Enter = new line · Esc = cancel. Resident via startup shortcut.
#Requires AutoHotkey v2.0
#SingleInstance Force

InboxDir := "K:\Projects\PKMS\vault\inbox"

CapGui := Gui("+AlwaysOnTop -MinimizeBox", "PKMS capture")
CapGui.SetFont("s11", "Segoe UI")
EditBox := CapGui.Add("Edit", "w520 r5")
CapGui.SetFont("s9 cGray", "Segoe UI")
CapGui.Add("Text", "xm", "Enter = save · Shift+Enter = new line · Esc = cancel")
CapGui.OnEvent("Close", (*) => CapGui.Hide())
CapGui.OnEvent("Escape", (*) => CapGui.Hide())

#n:: {
    EditBox.Value := ""
    CapGui.Show("AutoSize Center")
    EditBox.Focus()
}

#HotIf WinActive("PKMS capture ahk_class AutoHotkeyGUI")
Enter:: SaveCapture()
+Enter:: Send("{Enter}")
#HotIf

SaveCapture() {
    global EditBox, CapGui, InboxDir
    text := Trim(EditBox.Value, " `t`r`n")
    if (text = "") {
        CapGui.Hide()
        return
    }
    if !DirExist(InboxDir)
        DirCreate(InboxDir)
    stampFile := FormatTime(, "yyyy-MM-dd_HHmmss")
    stampMeta := FormatTime(, "yyyy-MM-dd HH:mm:ss")
    slug := Trim(RegExReplace(StrLower(SubStr(text, 1, 32)), "[^a-z0-9]+", "-"), "-")
    if (slug = "")
        slug := "capture"
    path := InboxDir "\" stampFile "_" slug ".md"
    n := 1
    while FileExist(path) {  ; same-second collision: suffix, never overwrite
        n += 1
        path := InboxDir "\" stampFile "_" slug "-" n ".md"
    }
    FileAppend("---`ncaptured: " stampMeta "`nsource: hotkey`n---`n`n" text "`n", path, "UTF-8-RAW")
    CapGui.Hide()
    TrayTip("saved ✓", "PKMS capture")
}
