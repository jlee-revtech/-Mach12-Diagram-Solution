---
name: Word Redline Add-in
description: Office.js task-pane add-in that runs AI clause redlining and playbook compliance checks inside Microsoft Word, applying accepted edits as native tracked changes and comments, with all model traffic and clause intelligence held server-side.
workstreams: offer-to-cash
license: internal
---

# Word Redline Add-in

## What It Does

The Word Redline add-in (repo `word-redline`) is a thin Office.js task pane that brings the clause library, the negotiation playbook, and the model into Microsoft Word, where negotiators already work. It exists because procurement-mature buyers reject the import-to-a-proprietary-editor-and-export-back round trip most contract AI tools require, and because they will not accept a vendor-locked model.

The workflow: read the active document or selection through Office.js; post the text plus tenant configuration to the backend's redline endpoint; receive structured edit operations; render them in the pane, where a negotiator accepts, rejects, counters, or defers; apply accepted proposals as **native Word tracked changes** plus **native Word comments**.

| Payload | Fields |
|---|---|
| Edit operation | Character range, original text, proposed text (empty means strike), rationale, source (user, ai, ai-edited, playbook, counterparty), severity (low, medium, high, blocker), optional FAR reference, disposition |
| Playbook finding | Kind (gap, conflict, addition), message, severity, optional FAR reference, optional suggested edit |

Two build variants. The clause-library variant talks to the CLM backend around a clause corpus, a playbook, and a redline session. The Contract Studio variant talks to the Contract Studio API around opportunities, negotiation rounds, and positions: it lists opportunities and rounds (including best-and-final), analyzes the document into position cards, adds a card to a round, and pushes the current selection as a single position. Both share one shape: the pane is a thin client, the intelligence is on the server.

One engineering detail matters in a demo. Word's document search rejects strings longer than roughly 255 characters, so for a long clause the add-in anchors on a leading and a trailing chunk and expands the head range across the span. Real clauses are long; this is not an edge case.

Deliberately absent: business logic, the clause library, the playbook, market-term data, and model dispatch. All server-side, so no model credential lands in a customer's Word installation.

Status: build-verified, sideloadable, in-Word runtime tested on the clause-library variant. One variant's manifest references icon assets that are not present, so the ribbon tile renders blank even when the dev server runs. Fix the icons before a client demo.

## When To Position It

Position it when negotiation happens in Word with track changes, which it always does; when the client rejected a contract AI tool because it converts the .docx through a third-party engine; when they require bring-your-own-model, including one inside a controlled boundary; when the clause playbook exists as a document nobody consults during negotiation; when counterparty redlines are read line by line to build a position ledger; and when we sell Contract Studio and the negotiation module must reach the negotiator's desk.

Do NOT position it when:

- There is no backend. Without the CLM or Contract Studio API reachable it does nothing. Never sell it standalone.
- Contracts live in a PDF workflow with no Word stage. There is nothing to redline.
- Negotiators use Word on an unsupported platform. Verify the Office.js surface first.
- The requirement is signature and workflow. That is DocuSign plus the CLM.
- The client will not deploy add-ins. Do the redline in the web application instead.

## How It Fits The SAP Design

Touches Offer-to-Cash only. This is a negotiation instrument, not an ERP component.

Replaces: manual clause-by-clause comparison against a playbook; the position ledger built by hand from a counterparty redline; copy-paste from a clause library.

Augments: the CLM's clause corpus, its deviation and obligation model, and its negotiation rounds. Everything the pane shows came from there and everything it captures goes back. Word remains the document authority; nothing is converted.

Standard-SAP alternative: none. SAP has no in-Word redlining surface. Ariba Contracts has a Word add-in for template assembly and clause insertion, a different job, bound to Ariba's workspace. The accelerator wins on native tracked changes, bring-your-own-model dispatched server-side, proposals grounded in the client's corpus rather than the model's memory of contract law, and accepted positions flowing into negotiation rounds. It does not win as a document comparison engine, a signature tool, or a contract manager.

## Integration Points

In: the document body or current selection through Office.js, plus the tenant identifier and playbook. The clause corpus and playbook are never sent to the client; they resolve server-side.

Out: accepted edits applied as tracked changes and comments; extracted positions posted to a negotiation round; a selection posted as a single position. The redline session persists server-side with each disposition.

Auth: the production path is Microsoft Identity Platform single sign-on, forwarding the M365 token the negotiator already holds. No model credential reaches the client.

Deployment: webpack 5 and TypeScript over HTTPS with locally trusted dev certificates, registered through an XML Office manifest (webpack rather than Vite, because Office requires specific HTTPS dev-server behavior). In production the pane is hosted on a static origin and the manifest distributed through the M365 admin center. The pane's dev server runs on its own port; if it is down the ribbon tile appears but does nothing, which accounts for most reported add-in failures. Configure the backend's CORS for the add-in origin before the demo.

## SAP-Side Objects

None. The add-in has no SAP footprint and never touches SAP. Its backend does, indirectly.

| Object | Type | Purpose |
|---|---|---|
| Clause corpus and playbook | Backend tables, not SAP | Authoritative clause text, alternates, fill-ins, company position, negotiation guidance. Held server-side, never shipped to the client |
| Negotiation rounds and positions | Backend tables, not SAP | Where accepted proposals and pushed selections land |
| Awarded contract clause set | Backend tables, not SAP | The conformed clause set that, on award, is pushed into the SD contract by the contract sync wrapper. The only path by which anything the negotiator touched reaches SAP |

If a client asks whether the add-in talks to SAP, the answer is no, and that is the correct architecture. Word talks to the CLM. The CLM talks to SAP.

## Demo Path

1. Open a real subcontract or counterparty redline in Word, track changes on. We start in the tool the negotiator already has open.
2. Open the task pane. It shows the tenant and the selected playbook: configured to this deal, not generic.
3. Click Analyze document. The pane reads the body through Office.js and posts to the backend. No upload, no conversion.
4. Proposals arrive as cards with rationale, severity, and FAR reference. Show a blocker. The model is grounded in the client's corpus and it says why.
5. Show a playbook finding classified as a gap: a required flowdown clause missing entirely. The redline covers absent language too.
6. Accept a proposal. It lands as a native tracked change plus a comment carrying the rationale.
7. Accept a proposal spanning several hundred characters. It applies cleanly. Most add-ins break here.
8. Reject one and counter another. The disposition persists against the redline session.
9. Select a paragraph, Send selection as position. It appears in the negotiation round with topic, our position, customer position, priority.
10. Open Contract Studio's negotiation page. The rounds rail, posture, and position table are populated from the document you just worked.

## Positioning Notes

To a CFO: your negotiators read every clause against a playbook that lives in a PDF, and the position ledger for a best-and-final offer is reconstructed from memory and email. This reads the playbook for them and builds the ledger as a byproduct of work they were already doing.

To a contracts lead: it is Word. Track changes, comments, formatting, and signature blocks intact, because we never convert the file. Every proposal carries a rationale and a FAR reference.

To a CIO: no model credential is installed on a workstation. The pane sends text to our backend, which dispatches to whichever model the tenant configured, including one inside your boundary. The add-in holds no clause data and no business logic.

Discriminator vs Deltek Costpoint and Cognitus: no overlap with either.

Discriminator vs Dassian standalone: complementary. Dassian owns post-award clause flowdown and contract structure; this owns the negotiation surface, which Dassian lacks. Where a client owns Dassian, the add-in plus Contract Studio's capture half is a clean, non-overlapping proposal.

Discriminator vs Spellbook, Dioptra, Icertis ExploreAI, and the vendor-native Word add-ins: use two arguments. Document fidelity, because any tool that converts the .docx through its own engine eventually loses a comment, a style, or a signature block. And model choice, because the first-party add-ins are locked to one vendor's model and licensed per end user, while clients with a controlled boundary need the model where they say.
