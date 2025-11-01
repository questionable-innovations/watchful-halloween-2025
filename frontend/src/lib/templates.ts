import { uuid } from "./utils";

export const messageTemplates = [
    {
        name: "Quick Chat",
        messages: [
            { id: uuid(), side: "left", content: "Hey, got a minute?" },
            { id: uuid(), side: "right", content: "Sure, what's up?" },
        ]
    }, {
        name: "Hamster Moment",
        messages: [
            { id: uuid(), side: "right", content: "what" },
            { id: uuid(), side: "left", content: "idk i just got the worst news ever" },
            { id: uuid(), side: "left", content: "I accidentally microwaved my hamster" },
        ]
    }, {
        name: "Bomb Threat",
        messages: [
            { id: uuid(), side: "right", content: "I have a bomb"},
            { id: uuid(), side: "left", content: "what"},
            { id: uuid(), side: "left", content: "why"},
            { id: uuid(), side: "right", content: "because im at the airport" },
        ]
    }
]
