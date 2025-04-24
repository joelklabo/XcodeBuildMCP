//
//  ContentView.swift
//  MCPTest
//
//  Created by Cameron on 16/02/2025.
//

import SwiftUI
import OSLog

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Hello, world!")

            Button("Log something") {
                Logger.myApp.debug("Oh this is structured logging")
                debugPrint("I'm just plain old std out :-(")
            }
        }
        .padding()
    }
}

#Preview {
    ContentView()
}

// OS Log Extension
extension Logger {
    static let myApp = Logger(
        subsystem: "com.cameroncooke.MCPTest", 
        category: "default"
    )
}
    
