# Engender Engine™️ | Checkpoint 01

This package contains everything locked so far for Engender Engine™️.

## Current status

Checkpoint 01 | Export Plumbing

This is not the full finished app yet. This is the verified build packet for the first plumbing checkpoint.

## What this package does

The app has one unstyled test button:

Generate Test MIDI Pack

When clicked, it generates a ZIP containing:

```text
EngenderEngine_[Fingerprint]_140BPM.zip
├── 1_Chords_FSharp_HarmonicMinor.mid
├── 2_Melody_FSharp_HarmonicMinor.mid
├── 3_808_140BPM.mid
└── pack_manifest.json
```

## What is included

Seeded deterministic random engine

Lineage-aware fingerprinting

Mock MIDI structure

MIDI writer layer

ZIP export layer

Mobile browser blob download utility

Manifest export

Simple React test harness

## What is not included yet

Real 4 bar clock engine

Real chord progression logic

Real melody generation logic

808 triplet roll generation

Mutation controls

DNA preset controls

Finished UI

Payment or backend

## Install

```bash
npm install
npm run dev
```

## Lovable instruction

Treat this as Checkpoint 01 only. Do not redesign. Do not add features. First verify that the app runs and the ZIP downloads correctly.

## Checkpoint 01 pass conditions

ZIP downloads

ZIP extracts

pack_manifest.json opens

MIDI imports into FL Studio Mobile

Note appears on grid

No corruption

No timing anomaly

## Next checkpoint after pass

Checkpoint 02 | Real deterministic 4 bar clock engine.
