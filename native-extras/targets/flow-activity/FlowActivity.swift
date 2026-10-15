import ActivityKit
import SwiftUI
import WidgetKit

// Flow on the Lock Screen and in the Dynamic Island: the task, the sprint,
// and a countdown that keeps running even when the app is closed.

public struct FlowAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var sprint: Int
        public var sprints: Int
        public var endsAt: Date
        public var onBreak: Bool
        public var held: Int
    }
    public var task: String
    public var headName: String
}

private let night = Color(red: 0.075, green: 0.086, blue: 0.102)
private let water = Color(red: 0.36, green: 0.78, blue: 0.95)

struct FlowLockScreen: View {
    let context: ActivityViewContext<FlowAttributes>
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "drop.fill").font(.title2).foregroundStyle(water)
            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.onBreak ? "Break. Breathe." : context.attributes.task)
                    .font(.headline).foregroundStyle(.white).lineLimit(1)
                Text("Sprint \(context.state.sprint) of \(context.state.sprints) · \(context.attributes.headName) is holding \(context.state.held) messages")
                    .font(.caption).foregroundStyle(.white.opacity(0.7)).lineLimit(1)
            }
            Spacer()
            Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
                .font(.system(.title2, design: .rounded).monospacedDigit())
                .foregroundStyle(water)
                .frame(width: 80, alignment: .trailing)
        }
        .padding(16)
        .activityBackgroundTint(night)
    }
}

struct FlowLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: FlowAttributes.self) { context in
            FlowLockScreen(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label("Flow", systemImage: "drop.fill").foregroundStyle(water)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
                        .monospacedDigit().foregroundStyle(water)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.task).font(.headline).lineLimit(1)
                }
            } compactLeading: {
                Image(systemName: "drop.fill").foregroundStyle(water)
            } compactTrailing: {
                Text(timerInterval: Date()...context.state.endsAt, countsDown: true)
                    .monospacedDigit().frame(width: 44).foregroundStyle(water)
            } minimal: {
                Image(systemName: "drop.fill").foregroundStyle(water)
            }
        }
    }
}

@main
struct EternityWidgets: WidgetBundle {
    var body: some Widget {
        FlowLiveActivity()
    }
}
