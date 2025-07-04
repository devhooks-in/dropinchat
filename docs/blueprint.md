# **App Name**: TempTalk

## Core Features:

- Homepage Actions: Provide options on the homepage to either create a new chat room or join an existing one.
- Room ID Generation: Generate a unique, random room ID when creating a new chat room. This ID will be part of the room's URL, to be shared with other users.
- Name Prompt: Prompt the user to enter a name before joining the chat room. This name will be displayed next to their messages.
- Real-time Messaging: Enable real-time messaging using Socket.IO. Messages should be instantly visible to all connected users in the room.
- Multi-user Display: Display messages from multiple users in a clear and organized manner, with user names clearly indicated next to each message.
- Temporary Rooms: Implement temporary chat rooms that exist only in memory or for a limited time. The app should be configured to discard all messages when the last user disconnects from a given room.
- Profanity Filtering: Implement a profanity filter. The tool should automatically detect and filter inappropriate content. The user can turn on or turn off the feature.

## Style Guidelines:

- Primary color: Deep sky blue (#1f2937) to evoke a sense of communication and clarity.
- Background color: Very light cyan (#e5e7eb), almost white, to keep the focus on the content. Very low saturation (around 15%).
- Accent color: Medium blue (#212121) for interactive elements and highlights. Chosen to be close to the primary, but desaturated for contrast.
- Body and headline font: 'Inter', a grotesque-style sans-serif with a modern look.
- Use simple, outline-style icons for chat room actions.
- Clean, minimalistic layout with a focus on readability. The chat interface should be intuitive and easy to navigate.
- Subtle animations for message delivery and user interactions.