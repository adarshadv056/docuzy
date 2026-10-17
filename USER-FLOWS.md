# Docuzy — User Flows and Navigation

## 1. Purpose

This document defines how users navigate Docuzy, how they move between pages, what happens after each action, and how behavior changes based on authentication, usage limits, and subscription status.

The objective is to make Docuzy a unified document workspace where users can use tools, save their results, organize their files, and interact with documents without unnecessary friction.

Implement the flows defined here. Do not invent alternative navigation patterns or introduce new product behavior without an approved change.

## 2. User Types and Access Levels

Docuzy has three primary access levels.

### 2.1 Anonymous User

A visitor who has not signed in.

Can:
- Access the landing page and public tool pages.
- Use supported document and image tools within the anonymous usage allowance.
- Upload files for processing.
- Preview and download processed results.
- See the option to save results to Docuzy.
- Create an account when prompted or through the normal sign-in flow.

Cannot:
- Access a personal document dashboard.
- Save files permanently to a personal Docuzy workspace without an account.
- Use paid AI document chat.

### 2.2 Logged-in Free User

A user authenticated through Google who does not have an active paid entitlement.

Can:
- Access the personal dashboard.
- View recent files and all accessible stored files.
- Upload and store documents within the applicable storage allowance.
- Access available document and image tools with the logged-in free usage allowance.
- Save tool results to Docuzy.
- Select existing Docuzy documents from compatible tools.
- View subscription and storage usage information.
- Upgrade to a paid plan.

Cannot:
- Use paid AI document chat unless explicitly included in their entitlement.

### 2.3 Paid User

An authenticated user with an active subscription granting paid access.

Can:
- Access all applicable free-user capabilities.
- Use AI document chat according to the subscription entitlement.
- Access the tool usage allowance and storage capacity included in the plan.
- Manage documents and conversations associated with their account.

All paid features must be checked against the user's actual subscription entitlement on the server.

## 3. Global Navigation

### Public Navigation

The public landing page should communicate:
- What Docuzy does.
- Its document tools.
- AI-powered document assistance.
- Document storage and organization.
- Pricing or plan information.
- The primary action to get started.

Users should be able to discover and use public tools without being forced to create an account first.

### Authenticated Navigation

The application sidebar should provide access to:

- **Recent:** Recently accessed or modified documents.
- **All Files:** The user's stored documents and supported organization controls.
- **All Tools:** The available document and image utilities.
- **Chats:** Previous document conversations, or an equivalent accessible chat-history entry point.
- **Subscription:** Current plan, upgrade options, and relevant usage information.
- **Storage Usage:** A visual indicator of used and available storage.
- **Account:** The user's account controls and sign-out action.

The exact sidebar layout and responsive behavior are defined in `DESIGN.md` and `PAGE-SPECS.md`.

The sidebar should remain consistent throughout authenticated pages.

## 4. Landing Page Flow

1. The user visits the landing page.
2. The page explains Docuzy's core value: tools, storage, and AI-assisted document workflows.
3. The user can explore available tools without signing in.
4. The user can navigate to pricing or other public information.
5. The user can start using a tool or choose to sign in.

### Landing Page Actions

- **Use a Tool:** Navigate to the selected public tool.
- **Get Started / Sign In:** Start Google authentication.
- **Explore Tools:** Navigate to the tools listing.
- **View Pricing:** Navigate to the pricing section or page.

When a user is already authenticated, entry points should lead to the appropriate workspace destination rather than unnecessarily requesting another login.

## 5. Anonymous Tool Usage Flow

1. The user opens a tool page.
2. The user uploads a local file or selects a supported input.
3. The tool validates the file and its requirements.
4. The user configures the operation if necessary.
5. The user starts processing.
6. Docuzy processes the file and displays progress.
7. The user previews the result where preview is supported.
8. The user can download the result or choose to save it to Docuzy.

### Result Actions

**Download**
- Provide the processed output for download.
- Do not require account creation solely to download a result when the anonymous allowance permits it.

**Save to Docuzy**
- If the user is anonymous, explain the benefit of creating an account and initiate Google sign-in.
- Preserve the processed result during authentication where technically feasible.
- After successful authentication, save the result to the user's workspace.
- Confirm that the file has been saved and provide a route to open it.

Do not show a success message until the save operation has actually succeeded.

### Anonymous Usage Limits

Anonymous users have a configurable usage allowance.

When the user attempts an operation that exceeds the applicable limit:
1. Stop the restricted operation before processing begins, unless the operation is already authorized under a previously reserved allowance.
2. Show an account-creation prompt.
3. Explain that signing in provides an additional free usage allowance, document storage, and a personal workspace.
4. Offer an action to continue with Google.
5. Allow the user to dismiss the prompt and continue browsing.

Where feasible, preserve the user's input and current tool configuration.

Do not require authentication for unrelated actions that remain within the anonymous allowance.

## 6. Usage Limit and Upgrade Flow

Usage allowances must be configurable by access level and tool.

The intended entitlement model is:

- Anonymous user: anonymous allowance.
- Logged-in free user: logged-in free allowance.
- Paid user: plan-specific allowance.

The allowance may differ by operation, file size, processing cost, or other defined product rules. Do not assume every tool must use the same limit model.

When a user exhausts their allowance:
- Explain which allowance has been exhausted.
- Show the next available option.
- For anonymous users, offer account creation.
- For free users, explain the applicable reset or upgrade options.
- For paid users, explain the applicable plan limit, reset, or upgrade options.

Do not promise unlimited usage unless the plan explicitly provides it.

### Enforcement Rules

- Enforce limits on the server.
- Prevent parallel requests from bypassing usage limits.
- Record usage consistently.
- Handle failed operations according to the documented billing and usage policy.
- Do not rely exclusively on browser storage or client-side counters.

Exact quotas, reset periods, and subscription prices are defined in the relevant plan configuration and billing specifications, not hardcoded into the UI flow.

## 7. Google Authentication Flow

Google is the currently supported authentication provider.

### Sign-In

1. The user chooses Sign In or continues from an authentication prompt.
2. Docuzy starts Google authentication.
3. The user completes or cancels the authentication process.
4. If successful, Docuzy establishes the authenticated session.
5. Docuzy resolves the user's account, access level, and subscription entitlement.
6. The user is redirected to the appropriate destination.

### Sign-Up

New users authenticate through Google and receive a Docuzy account.

After successful account creation:
- Initialize the user's workspace and default account state as required.
- Apply the logged-in free usage allowance.
- Display the dashboard or the intended post-authentication destination.
- Preserve the original action where appropriate.

### Redirect Rules

If authentication was initiated by an action such as saving a processed document:
- Return the user to that action after authentication.
- Complete the pending action if it remains valid and the user authorizes it.
- Otherwise, show the relevant file or tool and allow the user to continue.

If authentication was initiated from the landing page without a pending action, redirect the user to the dashboard.

Validate return destinations to prevent unsafe external redirects.

If authentication fails or is cancelled, retain the user's existing anonymous session and show an appropriate message.

## 8. Dashboard Flow

The dashboard is the primary entry point for authenticated users.

It should provide:

- Recent files.
- A clear path to all files.
- Access to all tools.
- Storage usage and subscription information.
- A document chat entry point.
- Appropriate empty states for new users.

### Recent Files

Each recent file should provide the relevant actions supported by that file type, such as:
- Open the document.
- Continue working with it.
- Start a chat about it if AI access is available.
- Access applicable file management actions.

Opening a file should navigate to its appropriate viewer or workspace page.

### New User Empty State

If the user has no stored files:
- Explain how to upload a document.
- Provide a clear action to explore tools or upload a file.
- Introduce document chat without implying that paid AI is available to free users.
- Avoid displaying a broken or empty dashboard.

### Dashboard Chat Entry Point

The dashboard should provide a prompt such as "Chat with your document" or "Ask anything about your document."

The user must select or supply a document context before starting a document-specific conversation.

## 9. Document Chat Flow

AI document chat is a paid feature.

### Starting a Chat

1. The user opens the dashboard.
2. The user chooses the document chat entry point.
3. The user selects a stored document or uploads a supported document.
4. Docuzy checks whether the user has the required AI entitlement.
5. If authorized, the user can enter a question.
6. The user submits the question.
7. Docuzy retrieves relevant document context and generates a response.
8. The conversation appears in the chat interface.

The AI must use the selected document context for document-specific questions and communicate when it cannot find a reliable answer in the available content.

### Dashboard Chat Panel

When the user submits a question from the dashboard:
- Open a right-side chat panel.
- Display the selected document context and conversation.
- Keep the dashboard accessible behind or alongside the panel.
- Allow the user to continue asking follow-up questions.
- Provide a top-edge arrow control to expand the panel into a larger chat view and collapse it again.
- Preserve the conversation when the panel is collapsed or expanded.

### Full Chat View

When the user expands the chat:
- Display the conversation in a dedicated, larger layout.
- Provide a clear way to return to the chat list.
- Keep the current conversation and selected document context intact.
- Allow the user to continue the conversation without restarting it.

### Chat History

Users should be able to access previous conversations through the chat list.

Selecting a conversation should:
- Open the existing conversation.
- Restore its messages and associated document context.
- Allow follow-up questions if the user still has the required entitlement and the document remains accessible.

Starting a new chat must not silently overwrite an existing conversation.

Conversation ownership and document access must be validated on the server.

### Free User Access

If a free user attempts to start or continue paid AI chat:
- Show an upgrade prompt.
- Explain the benefits of document chat.
- Provide a route to the pricing or upgrade experience.
- Preserve the user's current document and draft question where feasible.

Do not expose paid AI operations through client-side-only checks.

## 10. All Files Flow

1. The user selects All Files from the sidebar.
2. Docuzy displays the files the user is authorized to access.
3. The user can search, browse, and use supported organization features.
4. The user selects a file to open it.
5. The user can perform supported file actions.

The interface should distinguish between loading, empty, error, and populated states.

Files must not become accessible to other users simply because a file identifier is known.

Deleting a file, if supported, must clearly communicate the consequences and require the appropriate confirmation.

## 11. All Tools Flow

The directory of every tool lives at `/tools` (public, no sign-in required). Individual tools are served by the dynamic route `/tools/<slug>`, where `<slug>` comes from the tool catalog.

1. The user selects All Tools (or "Browse all tools" from the landing page/nav).
2. Docuzy displays the available tools grouped by category (PDF, Image, Other) for easy discovery.
3. The user selects a tool.
4. Docuzy opens the corresponding tool page at `/tools/<slug>`.
5. The user supplies an input file.
6. The user processes the file.
7. The user downloads or saves the result.

Tools that are not built yet appear in the directory as clearly labelled, non-clickable "Coming soon" entries — never as if they were functional (DESIGN.md).

Tool discovery and tool usage should remain available to anonymous users wherever the tool is intended to be public.

Paid or otherwise restricted operations must display their access requirements clearly.

## 12. Using Existing Docuzy Files in Tools

Compatible tool pages should allow users to choose documents already stored in Docuzy.

The input selection experience should support:
- Uploading a local file.
- Selecting a stored Docuzy file through a file picker.
- Dragging and dropping a supported file into the tool's designated input area.
- Clear indication of the selected input.

Where appropriate, users should be able to drag a file from the Docuzy file list into a tool's input area.

### File Selection Rules

- Only show files compatible with the selected operation.
- Validate file type, size, and operation requirements.
- Preserve the existing selected input when the user changes a compatible setting.
- Make replacing or removing the selected input straightforward.
- Provide accessible alternatives to drag-and-drop.

Anonymous users can use local uploads but cannot select files from a personal Docuzy workspace.

If a user tries to access a stored file without an authenticated session, prompt for sign-in and resume the intended action where feasible.

## 13. Saving Processed Results

Saving is a first-class action throughout the product.

After a successful tool operation, offer:
- Download.
- Save to Docuzy.

For authenticated users:
1. The user chooses Save to Docuzy.
2. Docuzy validates storage access and available capacity.
3. The result is stored in the user's workspace.
4. Docuzy confirms success and provides an action to open the saved file.

If storage capacity is insufficient, explain the issue and provide the applicable storage-management or upgrade option.

Saving must not silently overwrite an existing document. Any replacement or overwrite behavior must be explicit.

## 14. Subscription and Storage

The sidebar should display relevant subscription information and a storage usage indicator.

The user should be able to understand:
- Their current plan.
- Storage used.
- Storage available under their plan.
- Their applicable usage allowance.
- Available upgrade options.

Storage and subscription values must reflect the authoritative server-side state.

The interface should update after successful uploads, saves, deletions, subscription changes, and other relevant operations.

## 15. Global Error and Edge-Case Handling

All flows must handle:

- Failed uploads.
- Unsupported or oversized files.
- Processing failures.
- Network interruptions.
- Expired authentication sessions.
- Authentication cancellation.
- Failed saves.
- Insufficient storage.
- Exhausted usage allowances.
- Inaccessible or deleted documents.
- Missing AI context.
- Failed AI responses.
- Subscription expiration or entitlement changes.

Show actionable messages and preserve user work where feasible.

Never show a successful upload, save, processing operation, or AI response status unless the operation has actually succeeded.

## 16. Security and Access Rules

- Users may access only documents and conversations they are authorized to access.
- Authentication and subscription entitlements must be verified server-side.
- Anonymous usage limits must not depend solely on client-side state.
- File selection, saving, downloads, and AI access must validate permissions.
- Return URLs after authentication must be validated.
- Sensitive file contents must not be exposed through unauthorized APIs, logs, or client responses.

## 17. Related Documentation

- `AGENTS.md` — AI coding agent instructions, technical conventions, existing architecture overview, and rules for preserving working functionality.
- `PRODUCT.md` — Product vision, target audience, core features, scope, and product principles.
- `USER-FLOWS.md` — User journeys, navigation, authentication, usage limits, subscriptions, document management, and AI chat behavior.
- `DESIGN.md` — Visual direction, design system, typography, colors, layouts, reusable components, responsive behavior, and page-specific design requirements.
- `CONTENT.md` — SEO strategy, page titles, meta descriptions, headings, landing-page copy, tool-page content, FAQs, and approved user-facing text.

## 18. Guiding Principle

Users should be able to start working with Docuzy immediately, create an account when it provides value, keep their documents in one workspace, and access advanced AI capabilities through the appropriate subscription.

Every transition should be intentional, every restriction should be understandable, and every successful action should have a clear next step.