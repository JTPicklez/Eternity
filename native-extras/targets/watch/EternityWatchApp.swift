import SwiftUI
import WatchConnectivity

// Eternity on the wrist: your head teammate, what's next, and one tap into Flow.
// The phone sends a small snapshot over WatchConnectivity; nothing else is stored.

struct Snapshot: Codable {
    var headName: String = "Aibram"
    var headColor: String = "#3E8EF0"
    var nextTitle: String = "Calculus I"
    var nextTime: String = "9:00"
    var huddle: String = "Leave by 8:40. Tonight is cleared for demo prep."
    var flowEndsAt: Double? = nil
}

final class FamilyLink: NSObject, ObservableObject, WCSessionDelegate {
    @Published var snapshot = Snapshot()

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: context),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else { return }
        DispatchQueue.main.async { self.snapshot = snap }
    }

    func startFlow(minutes: Int) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["action": "startFlow", "minutes": minutes], replyHandler: nil)
    }
}

struct DiamondPebble: Shape {
    func path(in r: CGRect) -> Path {
        let s = min(r.width, r.height) / 100
        func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: r.minX + x * s, y: r.minY + y * s) }
        var path = Path()
        path.move(to: p(50, 4))
        path.addCurve(to: p(72, 20), control1: p(58, 4), control2: p(64, 10))
        path.addLine(to: p(90, 40))
        path.addCurve(to: p(90, 60), control1: p(96, 47), control2: p(96, 53))
        path.addLine(to: p(72, 80))
        path.addCurve(to: p(50, 96), control1: p(64, 90), control2: p(58, 96))
        path.addCurve(to: p(28, 80), control1: p(42, 96), control2: p(36, 90))
        path.addLine(to: p(10, 60))
        path.addCurve(to: p(10, 40), control1: p(4, 53), control2: p(4, 47))
        path.addLine(to: p(28, 20))
        path.addCurve(to: p(50, 4), control1: p(36, 10), control2: p(42, 4))
        path.closeSubpath()
        return path
    }
}

extension Color {
    init(hex: String) {
        let v = Int(hex.dropFirst(), radix: 16) ?? 0x3E8EF0
        self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
    }
}

struct PebbleView: View {
    var color: Color
    @State private var breathe = false
    var body: some View {
        ZStack {
            DiamondPebble().fill(color)
            HStack(spacing: 8) {
                Capsule().fill(Color(hex: "#1E2023")).frame(width: 5, height: 8)
                Capsule().fill(Color(hex: "#1E2023")).frame(width: 5, height: 8)
            }
            .offset(y: -2)
        }
        .scaleEffect(breathe ? 1.045 : 1)
        .animation(.easeInOut(duration: 2.25).repeatForever(autoreverses: true), value: breathe)
        .onAppear { breathe = true }
    }
}

struct ContentView: View {
    @EnvironmentObject var link: FamilyLink

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    PebbleView(color: Color(hex: link.snapshot.headColor)).frame(width: 40, height: 40)
                    Text(link.snapshot.headName).font(.headline)
                }
                Text(link.snapshot.huddle).font(.footnote).foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 2) {
                    Text("UP NEXT").font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.secondary)
                    Text(link.snapshot.nextTitle).font(.body.weight(.semibold))
                    Text(link.snapshot.nextTime).font(.system(.footnote, design: .monospaced))
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 16).fill(Color.white.opacity(0.08)))

                if let ends = link.snapshot.flowEndsAt {
                    Text(timerInterval: Date()...Date(timeIntervalSince1970: ends / 1000), countsDown: true)
                        .font(.system(.title2, design: .rounded).monospacedDigit())
                } else {
                    Button { link.startFlow(minutes: 50) } label: {
                        Label("Start Flow", systemImage: "drop.fill")
                    }
                    .tint(Color(hex: "#3E8EF0"))
                }
            }
        }
    }
}

@main
struct EternityWatchApp: App {
    @StateObject private var link = FamilyLink()
    var body: some Scene {
        WindowGroup { ContentView().environmentObject(link) }
    }
}
