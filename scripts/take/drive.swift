// Performs a scripted take: brings an app to the front and plays a list of
// steps as real mouse and keyboard events, with the showcase's house timings
// (scripts/take/style.json), so every recording is clean and repeatable.
//
//   swiftc -O scripts/take/drive.swift -o visuals/raw/_bin/drive
//   visuals/raw/_bin/drive scripts/take/style.json scripts/take/<take>.json [--dry]
//
// Steps (coordinates are screen points, top-left origin):
//   { "move": [x, y] }                 glide there (eased, slight arc)
//   { "click": [x, y] }                glide, rest, click, rest
//   { "doubleClick": [x, y] }          the same with a double-click (selects a word)
//   { "rightClick": [x, y] }           glide, rest, right-click (opens a context menu)
//   { "open": "/path/Set.als" }        open a file in the app (e.g. load a Live Set)
//   { "key": "e", "mods": ["cmd"] }    a key: letters, digits, up/down/left/right, return, escape, tab, delete
//   { "type": "[4] " }                 type text at the house pace
//   { "wait": 1200 }                   milliseconds
//   { "mark": "locators-sent" }        a named moment in the log, for the edit
//   { "park": true }                   glide to the house parking spot
//   { "shot": "/path/x.png" }          save a screenshot (for test runs)
// Every step is logged to stdout as {"t": seconds since start, ...} so the
// edit can be built from exact times. --dry logs without posting events.
// Needs Accessibility permission for the app that runs it (the terminal).

import AppKit
import CoreGraphics
import Foundation

struct Style: Decodable {
    let typeMs: Double, typeJitterMs: Double, tagBeatMs: Double
    let moveMs: Double, arc: Double, restMs: Double
    let park: [Double], leadInMs: Double
}

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: drive <style.json> <take.json> [--dry]")
    exit(2)
}
let dry = args.contains("--dry")
let style = try JSONDecoder().decode(Style.self, from: Data(contentsOf: URL(fileURLWithPath: args[1])))
let take = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[2]))) as! [String: Any]
let steps = take["steps"] as! [[String: Any]]
let appName = take["app"] as? String ?? "Live"

let start = Date()
func log(_ fields: [String: Any]) {
    var f = fields
    f["t"] = (Date().timeIntervalSince(start) * 1000).rounded() / 1000
    let data = try! JSONSerialization.data(withJSONObject: f, options: [.sortedKeys])
    print(String(data: data, encoding: .utf8)!)
    fflush(stdout)
}
func sleepMs(_ ms: Double) { usleep(useconds_t(max(0, ms) * 1000)) }

// ---- the app --------------------------------------------------------------
var target: NSRunningApplication?
func appInFront() -> Bool {
    NSWorkspace.shared.frontmostApplication?.processIdentifier == target?.processIdentifier
}
// Active isn't enough: a full-screen app can be active while the display still
// shows another Space. A big window of it in the on-screen list means it's seen.
func appOnScreen() -> Bool {
    guard let pid = target?.processIdentifier,
          let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]]
    else { return false }
    return windows.contains { w in
        guard (w[kCGWindowOwnerPID as String] as? Int32) == pid, (w[kCGWindowLayer as String] as? Int) == 0,
              let b = w[kCGWindowBounds as String] as? [String: Any], let rect = CGRect(dictionaryRepresentation: b as CFDictionary)
        else { return false }
        return rect.width > 1000
    }
}
func appReady() -> Bool { appInFront() && appOnScreen() }
// Stops the run if the app lost the front, so keys never land anywhere else
// (in Live itself, stray keys split clips or switch tracks off).
func requireFront(_ step: String) {
    if dry || appReady() { return }
    log(["step": "abort", "reason": "\(appName) is not in front and on screen", "before": step])
    exit(3)
}
if !dry {
    guard AXIsProcessTrusted() else {
        print("not trusted for Accessibility: allow the terminal in System Settings > Privacy & Security > Accessibility")
        exit(1)
    }
    let apps = NSWorkspace.shared.runningApplications.filter { ($0.localizedName ?? "").hasPrefix(appName) }
    guard let app = apps.first else {
        print("\(appName) isn't running")
        exit(1)
    }
    target = app
    // activate() alone can be refused when a terminal asks; `open -a` is not
    app.activate()
    if let url = app.bundleURL {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: "/usr/bin/open")
        p.arguments = ["-a", url.path]
        try? p.run()
        p.waitUntilExit()
    }
    // the lead-in only starts once the app is really on screen, so switching
    // to its Space by hand after starting the run is fine (gives up after 60 s)
    if !appReady() {
        log(["step": "waiting", "for": "\(appName) in front and on screen"])
        let deadline = Date().addingTimeInterval(60)
        while !appReady() && Date() < deadline { usleep(200_000) }
    }
}
sleepMs(style.leadInMs)
requireFront("start")

// ---- mouse ------------------------------------------------------------------
func mouseNow() -> CGPoint { CGEvent(source: nil)?.location ?? .zero }
func post(_ type: CGEventType, _ p: CGPoint) {
    if dry { return }
    CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left)?.post(tap: .cghidEventTap)
}
func ease(_ t: Double) -> Double { t * t * t * (t * (t * 6 - 15) + 10) }  // smootherstep, as in cut_take.py
var cursor = dry ? CGPoint(x: style.park[0], y: style.park[1]) : mouseNow()
func glide(to target: CGPoint) {
    let from = cursor
    let dx = target.x - from.x, dy = target.y - from.y
    let dist = (dx * dx + dy * dy).squareRoot()
    if dist < 1 { return }
    // a slight arc: bow sideways by a fraction of the distance, like a wrist
    let nx = -dy / dist, ny = dx / dist
    let ms = style.moveMs * min(1.2, max(0.7, dist / 600))
    let n = max(2, Int(ms / 8))  // 125 Hz
    for i in 1...n {
        let s = ease(Double(i) / Double(n))
        let bow = sin(s * .pi) * dist * style.arc
        let p = CGPoint(x: from.x + dx * s + nx * bow, y: from.y + dy * s + ny * bow)
        post(.mouseMoved, p)
        usleep(8000)
    }
    cursor = target
}

// ---- keys ---------------------------------------------------------------------
let keyCodes: [String: CGKeyCode] = [
    "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13,
    "e": 14, "r": 15, "y": 16, "t": 17, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
    "return": 36, "tab": 48, "space": 49, "delete": 51, "escape": 53,
    "left": 123, "right": 124, "down": 125, "up": 126,
]
func flags(_ mods: [String]) -> CGEventFlags {
    var f: CGEventFlags = []
    for m in mods {
        switch m {
        case "cmd": f.insert(.maskCommand)
        case "shift": f.insert(.maskShift)
        case "alt", "option": f.insert(.maskAlternate)
        case "ctrl": f.insert(.maskControl)
        default: break
        }
    }
    return f
}
// Real arrow presses carry the numeric-pad and fn flags; without them a web
// view inserts a placeholder glyph instead of moving the caret. (A system
// keyboard source made typed characters land in reverse order, so events
// have no source.)
let keySource: CGEventSource? = nil
let arrowCodes: Set<CGKeyCode> = [123, 124, 125, 126]

// Typed text is pressed as real keys on the ABC (US) layout, exactly what a
// keyboard sends: injected characters can skip the web view's caret update.
let typeKeys: [Character: (CGKeyCode, Bool)] = {
    var m: [Character: (CGKeyCode, Bool)] = [:]
    let letters: [Character: CGKeyCode] = [
        "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13,
        "e": 14, "r": 15, "y": 16, "t": 17, "o": 31, "u": 32, "i": 34, "p": 35, "l": 37, "j": 38, "k": 40, "n": 45, "m": 46,
    ]
    for (ch, code) in letters {
        m[ch] = (code, false)
        m[Character(ch.uppercased())] = (code, true)
    }
    let digits: [Character: CGKeyCode] = ["1": 18, "2": 19, "3": 20, "4": 21, "5": 23, "6": 22, "7": 26, "8": 28, "9": 25, "0": 29]
    for (ch, code) in digits { m[ch] = (code, false) }
    let punct: [Character: (CGKeyCode, Bool)] = [
        " ": (49, false), "[": (33, false), "]": (30, false), "{": (33, true), "}": (30, true),
        ";": (41, false), ":": (41, true), "'": (39, false), "\"": (39, true), ",": (43, false), "<": (43, true),
        ".": (47, false), ">": (47, true), "/": (44, false), "?": (44, true), "-": (27, false), "_": (27, true),
        "=": (24, false), "+": (24, true), "#": (20, true), "!": (18, true), "*": (28, true), "\n": (36, false),
    ]
    for (ch, v) in punct { m[ch] = v }
    return m
}()
func pressKey(_ code: CGKeyCode, _ mods: [String], settle: Bool = true) {
    if dry { return }
    var f = flags(mods)
    if arrowCodes.contains(code) { f.formUnion([.maskNumericPad, .maskSecondaryFn]) }
    for down in [true, false] {
        let e = CGEvent(keyboardEventSource: keySource, virtualKey: code, keyDown: down)
        e?.flags = f
        e?.post(tap: .cghidEventTap)
        usleep(12000)
    }
    if settle { usleep(50000) }  // let the web view settle between navigation keys
}
func typeChar(_ ch: Character) {
    if dry { return }
    if let (code, shift) = typeKeys[ch] {
        pressKey(code, shift ? ["shift"] : [], settle: false)
        return
    }
    // anything off the layout map falls back to an injected character
    let units = Array(String(ch).utf16)
    for down in [true, false] {
        let e = CGEvent(keyboardEventSource: keySource, virtualKey: 0, keyDown: down)
        e?.keyboardSetUnicodeString(stringLength: units.count, unicodeString: units)
        e?.post(tap: .cghidEventTap)
        usleep(8000)
    }
}

// ---- play -----------------------------------------------------------------------
log(["step": "start", "app": appName, "dry": dry])
for step in steps {
    requireFront(step.keys.sorted().joined(separator: ","))
    if let xy = step["move"] as? [Double] {
        glide(to: CGPoint(x: xy[0], y: xy[1]))
        log(["step": "move", "at": xy])
    } else if let xy = step["click"] as? [Double] {
        glide(to: CGPoint(x: xy[0], y: xy[1]))
        sleepMs(style.restMs)
        post(.leftMouseDown, cursor)
        usleep(60000)
        post(.leftMouseUp, cursor)
        log(["step": "click", "at": xy])
        sleepMs(style.restMs)
    } else if let xy = step["doubleClick"] as? [Double] {
        // a double-click selects the word under the pointer (e.g. the 4 in [4])
        glide(to: CGPoint(x: xy[0], y: xy[1]))
        sleepMs(style.restMs)
        if !dry {
            for clickState in [1, 2] {
                for type in [CGEventType.leftMouseDown, .leftMouseUp] {
                    let e = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: cursor, mouseButton: .left)
                    e?.setIntegerValueField(.mouseEventClickState, value: Int64(clickState))
                    e?.post(tap: .cghidEventTap)
                    usleep(30000)
                }
                usleep(60000)
            }
        }
        log(["step": "doubleClick", "at": xy])
        sleepMs(style.restMs)
    } else if let xy = step["rightClick"] as? [Double] {
        glide(to: CGPoint(x: xy[0], y: xy[1]))
        sleepMs(style.restMs)
        if !dry {
            for type in [CGEventType.rightMouseDown, .rightMouseUp] {
                CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: cursor, mouseButton: .right)?.post(tap: .cghidEventTap)
                usleep(60000)
            }
        }
        log(["step": "rightClick", "at": xy])
        sleepMs(style.restMs)
    } else if let file = step["open"] as? String {
        if !dry, let url = target?.bundleURL {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/bin/open")
            p.arguments = ["-a", url.path, file]
            try? p.run()
            p.waitUntilExit()
        }
        log(["step": "open", "file": file])
    } else if let key = step["key"] as? String {
        let mods = step["mods"] as? [String] ?? []
        guard let code = keyCodes[key] else { print("unknown key \(key)"); exit(2) }
        pressKey(code, mods)
        log(["step": "key", "key": key, "mods": mods])
    } else if let text = step["type"] as? String {
        log(["step": "type", "text": text])
        for ch in text {
            typeChar(ch)
            var ms = style.typeMs + Double.random(in: -style.typeJitterMs...style.typeJitterMs)
            if ch == "]" { ms += style.tagBeatMs }  // a beat after closing a tag
            sleepMs(ms)
        }
        log(["step": "typed", "text": text])
    } else if let ms = step["wait"] as? Double {
        sleepMs(ms)
    } else if let name = step["mark"] as? String {
        log(["step": "mark", "name": name])
    } else if let path = step["shot"] as? String {
        // a screenshot, for checking a test run (needs Screen Recording permission)
        if !dry {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
            p.arguments = ["-x", path]
            try? p.run()
            p.waitUntilExit()
        }
        log(["step": "shot", "path": path])
    } else if step["park"] != nil {
        glide(to: CGPoint(x: style.park[0], y: style.park[1]))
        log(["step": "park"])
    }
}
log(["step": "end"])
