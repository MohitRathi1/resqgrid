# ResQGrid 🚨

### AI-Powered Emergency Command & Resource Coordination System

<p align="center">
  <strong>Intelligent Decisions. Coordinated Response. Critical Time Saved.</strong>
</p>

<p align="center">
  An AI-assisted emergency command platform designed to coordinate incidents, optimize resource allocation, and adapt response strategies in rapidly evolving crisis situations.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Domain-Public%20Safety-blue" alt="Domain">
  <img src="https://img.shields.io/badge/Project-Hackathon%20Prototype-purple" alt="Project Type">
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB" alt="React">
  <img src="https://img.shields.io/badge/Backend-Node.js-green" alt="Node.js">
</p>

---
## 📌 Overview

Emergency response operations demand rapid coordination, accurate prioritization, and efficient utilization of limited resources. When multiple emergencies occur simultaneously, even a small disruption in resource availability can affect the entire response plan.

**ResQGrid** is an AI-assisted emergency command and resource coordination platform designed to address these challenges through centralized incident monitoring, dynamic resource allocation, and intelligent decision support.

The system combines a fast decision engine with specialized AI agents to evaluate emergency conditions, generate adaptive response plans, explain critical changes, and support human-supervised decision-making.

Rather than relying entirely on sequential AI reasoning for every operation, ResQGrid separates time-sensitive allocation decisions from contextual analysis and safety validation.

Its objective is to help emergency operators maintain situational awareness and respond effectively as crisis conditions evolve.

---
## 🎯 Problem Statement

Emergency control rooms are required to manage multiple incidents simultaneously while operating with limited resources such as ambulances, firefighting units, rescue teams, and medical personnel.

During rapidly evolving emergencies, unexpected events can disrupt existing response plans. A newly reported critical incident, an unavailable ambulance, or a sudden change in incident severity may require immediate reassessment of resource assignments.

Traditional coordination approaches can face several challenges:

* **Resource Constraints:** Limited emergency units must be distributed across multiple active incidents.
* **Competing Priorities:** Incidents with different severity levels and urgency require careful prioritization.
* **Dynamic Conditions:** New emergencies and resource unavailability can invalidate existing response plans.
* **Coordination Delays:** Manual reassessment of affected assignments can consume valuable response time.
* **Decision Transparency:** Emergency operators need to understand why resource assignments change and what consequences those changes may create.

These challenges affect emergency operators and first responders, where timely decisions and coordinated action are essential.

### The Core Challenge

How can an emergency response system continuously evaluate changing incident conditions, allocate limited resources efficiently, and adapt response plans while preserving human oversight over critical decisions?

---
## 💡 Proposed Solution

### ResQGrid — AI Emergency Command & Resource Coordination

ResQGrid proposes a centralized digital emergency command center that continuously monitors active incidents and available response resources.

When an emergency is reported, the system converts incident information into structured data, including severity, urgency, location, people at risk, and required response capabilities.

A fast decision engine evaluates the current incident state alongside available resources to generate a coordinated response plan.

The system is designed to adapt when conditions change rather than relying on a fixed allocation plan.

### Adaptive Emergency Response

Consider a scenario where a cardiac emergency, building fire, and road accident occur simultaneously while only three ambulances are available.

ResQGrid evaluates incident urgency, severity, resource compatibility, and estimated response time to propose resource assignments.

Now suppose a building collapse is reported while one ambulance becomes unavailable.

Instead of requiring the operator to manually reconstruct the entire response plan, ResQGrid:

1. Updates the current incident and resource state.
2. Identifies assignments affected by the change.
3. Re-evaluates available resources and response priorities.
4. Generates a revised allocation plan.
5. Uses specialized AI agents to explain changes and assess safety implications.
6. Presents consequential decisions for human review and approval.

### Core Design Principle

**Fast decision-making for time-sensitive allocation. Specialized AI reasoning for explanation, validation, and escalation. Human oversight for critical decisions.**

This separation is intended to reduce unnecessary AI processing in the critical decision loop while maintaining transparency and operator control.

---


