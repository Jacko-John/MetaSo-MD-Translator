# **CLAUDE.md**

## **1. Project Overview & Tech Stack**

**Auto-Managed:** This information is part of the Memory Bank system and is managed automatically.

* **Source:** `CLAUDE/projectSummary.md` (Auto-Generated/Updated)  
* **Action:** Automatically scan the repository to infer the Tech Stack, Core Purpose, and Key Directories. Maintain this high-level summary in `CLAUDE/projectSummary.md`. Do not wait for user input.

## **2. Memory Bank Protocol (CRITICAL)**

This project uses a persistent context system. You are the sole custodian of these files and must manage them **automatically**.

### **Core Context Files**

1. **CLAUDE/projectSummary.md** (Fully Automated): High-level project overview, tech stack, and architecture summary.  
2. **CLAUDE/activeContext.md** (Fully Automated): The "RAM" of the project. Contains current session goals, active tasks, and recent progress.  
3. **CLAUDE/patterns.md** (Fully Automated): Architecture standards and code patterns. Automatically detect and document new patterns or best practices as they emerge during development.  
4. **CLAUDE/decisions.md** (Fully Automated): Log of major architectural choices. Automatically record significant technical decisions and their rationale (ADR style) when they are made.  
5. **CLAUDE/troubleshooting.md** (Fully Automated): Known issues and fixes. Automatically document non-obvious solutions to errors or tricky bugs encountered during sessions to prevent future recurrence.

### **Operational Rules**

1. **Auto-Start:** Automatically read `CLAUDE/projectSummary.md` and `CLAUDE/activeContext.md` at the beginning of every session to establish context without user prompting.  
2. **Auto-Update:** You are required to **automatically update** ANY relevant Memory Bank file after a task or significant event.  
   * Update `activeContext.md` with progress.  
   * Update `patterns.md` if you established a new coding standard.  
   * Update `decisions.md` if you made an architectural choice.  
   * Update `troubleshooting.md` if you fixed a difficult bug.  
     **Do not ask the user for permission**—just do it to ensure session continuity and knowledge retention.  
3. **Auto-Init:** If these files do not exist, automatically initialize the Memory Bank structure (including scanning for the project summary) immediately.

## **3. Tooling & Environment Preference**

### **Code Intelligence (LSP) - HIGHEST PRIORITY**

**If an LSP (Language Server Protocol) skill is available, you MUST prefer it over text search.**

* **Navigation:** Use LSP to "Go to Definition" or "Find References" instead of `rg`'ing for function names.  
* **Symbols:** Use LSP workspace symbol search to find classes/functions/methods.  
* **Diagnostics:** Check LSP diagnostics for errors/warnings before and after edits to ensure correctness without running full test suites.  
* **Inspection:** Use hover/type definition features to understand data structures.

### **Search & Navigation (Text-Based Fallback)**

**Use only if LSP is unavailable or for broad text/regex searches.**

* **Listing Files:** Use `fd . -t f` or `rg --files`. (Avoid `tree` or `ls -R`).    
* **Searching Content:** Use `rg "pattern"`. (Avoid `grep`).  
* **Fallback:** If `rg`/`fd` are missing, gracefully fallback to `find` and `grep`.

### **Documentation**

When working on Claude Code specific features (MCP, hooks), use the `claude-docs-consultant` skill (if available) to verify official documentation.

## **4. Code Style & Conventions**

* **Linting:** Check `package.json` or `pyproject.toml` for lint commands before committing.  
* **Format:** Follow existing patterns in `CLAUDE/patterns.md`.