Offline Indoor Navigation System for Visually Impaired

An offline-first indoor navigation system designed to assist visually impaired users by providing real-time guidance using on-device computer vision, mobile sensors, and accessible feedback mechanisms. The system runs entirely on the user’s device as a Progressive Web App (PWA), ensuring low latency, privacy, and reliability in connectivity-restricted environments.

🚀 Features

Real-time indoor landmark detection (exit signs, stairs, elevators)

On-device movement tracking using camera and motion sensors

Rule-based navigation logic for stable guidance

Audio and haptic feedback for accessibility

Fully offline after first load (no backend required)

Privacy-preserving, edge-based inference

🧠 System Architecture

Module 1 – Landmark Detection:
Lightweight object detection using MobileNet-based models with TensorFlow.js.

Module 2 – Movement Tracking:
Visual odometry (lite) using optical flow and inertial sensors.

Module 3 – Navigation Logic:
Deterministic, rule-based decision system for direction guidance.

Module 4 – Accessibility Layer:
Voice instructions and vibration cues.

Module 5 – Offline PWA Integration:
Service workers for caching models and assets.

🛠️ Tech Stack

JavaScript, HTML, CSS

TensorFlow.js

MobileNet-SSD (fine-tuned)

Web APIs (Camera, Sensors, Speech, Vibration)

Progressive Web App (PWA)

📊 Model Training

Base dataset: Open Images Dataset

Custom indoor images for fine-tuning

Transfer learning on MobileNet-SSD

Optimized and converted for browser-based inference

🔒 Privacy & Offline Support

No server-side processing

No user data leaves the device

Works without internet after initial load

🎯 Use Case

Designed for indoor environments such as colleges, hospitals, malls, and offices where GPS is unreliable or unavailable.

📌 Status

Prototype / Academic Project
Focused on accessibility, explainability, and real-world feasibility.
