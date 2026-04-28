# Troubleshooting — Common Problems for Radiologists

This page covers problems you might encounter during your reporting session and what to do about them.
For infrastructure problems, contact your IT administrator.

---

## Study Not Found / Not Loading

**Problem:** A study is missing from the worklist, or clicking it does nothing.

**Steps:**
1. Wait 30–60 seconds and refresh the page (`F5`). Studies can take a moment to index after being sent to the system.
2. Check with the technician whether the study was sent to the correct PACS (Orthanc) — modalities are sometimes configured to send to a different destination.
3. Ask your administrator to check the Orthanc UI directly (`http://<server>:8042`) to see if the study arrived.

**If images load but appear blank or corrupted:**
- Try a different browser (Chrome or Firefox work best).
- Ask your administrator to check the DICOMweb connection.

---

## Voice Dictation (ASR) Not Working

**Problem:** Clicking the microphone does nothing, or the transcription is empty.

**Check in order:**
1. **Browser microphone permission** — look for a microphone icon in the browser address bar; click it and allow access.
2. **Correct microphone selected** — in your OS sound settings, ensure the dictation microphone is set as default input.
3. **ASR service running** — ask your administrator whether the ASR service (MedASR or Whisper) is active. Without it, the microphone button does nothing.
4. **Network/proxy issue** — if your hospital network uses a proxy, WebSocket connections required for real-time ASR may be blocked.

**Poor transcription quality:**
- Speak at a normal pace — too fast or too slow reduces accuracy.
- Use a headset or close-talking microphone instead of a built-in laptop microphone.
- Reduce background noise.
- Medical ASR is tuned for standard terminology — avoid heavy abbreviations or local slang.

---

## AI Does Not Generate an Impression

**Problem:** Clicking "Generate Impression" produces no output, or an error message appears.

| Message | Likely cause |
|---|---|
| "AI service unavailable" | No GPU overlay configured, or vLLM service is down |
| "Timeout" | AI processing took too long (large study or overloaded GPU) |
| "Mock response" | CPU-only mode — AI is disabled, a placeholder is returned |
| No message, spinner keeps spinning | Check network connection; reload the page |

**What to do:**
- In CPU mode or without AI: write the impression manually.
- Inform your administrator if AI was previously working and stopped.
- Continue reporting — AI assistance is optional; manual reporting is always possible.

---

## Viewer Problems

**Problem:** Images appear black, distorted, or do not scroll.

1. **Click on the viewer panel first** — the viewer requires focus before keyboard shortcuts and scroll work.
2. **Try resetting the view** — press `R` to reset windowing and zoom.
3. **Switch windowing preset** — click a preset (Lung, Bone, Soft Tissue) if the image is too dark/bright.
4. **Reload the study** — click on a different study, then click back to the original.
5. **Hard-refresh the browser** — `Ctrl + Shift + R` (Chrome/Firefox) to clear the cache.

**MPR or 3D view not available:**
- MPR and VRT require CT or MR studies with volumetric data. They are not available for CXR or incomplete CT series.
- Ask your administrator whether the reconstruction service is running.

---

## Report Not Saving

**Problem:** After clicking "Approve", the confirmation does not appear or an error is shown.

1. **Check your network connection** — the backend must be reachable.
2. **Check for validation errors** — the Findings or Impression field may be empty; the system requires at least minimal content.
3. **Try saving as draft first** — press `Ctrl + S` to test whether the draft save works.
4. **Reload and try again** — if the session timed out, reload the page; your draft may be preserved in the browser.

---

## Performance: Slow Loading / Long Wait Times

**Problem:** Studies take a long time to load, or the viewer scrolls slowly.

- **Image prefetch:** the system prefetches series automatically, but large CT/MR studies take 30–60 seconds to fully load. Partial loading is normal — images appear progressively.
- **Browser hardware acceleration:** ensure GPU acceleration is enabled in your browser settings (Chrome: Settings → System → Use hardware acceleration).
- **Multiple tabs:** close unused browser tabs to free memory.
- **Large 3D reconstructions:** VRT volumes are GPU-intensive. If the 3D viewer is slow, switch to the MPR view.

---

## Prior Studies Not Appearing

**Problem:** The Prior Studies panel is empty, but you know previous studies exist.

- Prior studies are matched by patient ID from the PACS. If the patient ID differs across studies (e.g., due to a name change or ID correction), automatic matching may fail.
- Ask your administrator to verify that prior studies are stored in the same Orthanc instance.
- You can manually open any study from the worklist in a second browser tab for manual comparison.

---

## When to Contact Your Administrator

Contact IT/administration for:

- ASR service is consistently down
- AI model is not available
- Studies are not arriving in the worklist from the modality
- Authentication or login problems
- Any patient data concern (PHI visible in logs, unexpected data)

When reporting a problem, provide:
- Time the problem occurred
- Study UID or patient ID (without full patient name in email)
- Browser name and version
- Screenshot of any error message
