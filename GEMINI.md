# Gemini CLI Optimization Guide: Token-Efficiency & Cost-Saving
**Project Stack:** Node.js, Next.js, Supabase, Tailwind, React
**Target Model:** Gemini 3 Flash (PAYG)

This guide provides a set of rules, configurations, and prompt engineering strategies to maximize your token allowance and minimize overhead when using the Gemini CLI.

---

## 1. CLI Configuration Commands
Run these in your terminal to set global behaviors that favor efficiency over "deep thinking" for standard tasks.

| Command | Purpose |
| :--- | :--- |
| `gemini config set thinking_level minimal` | Reduces "reasoning" output tokens for simple UI/CSS tasks. |
| `gemini config set model gemini-3-flash` | Ensures you are always using the most cost-effective model. |
| `gemini config set auto_approval false` | **Important:** Keeps you in control. Prevents agents from running loops that burn tokens without your consent. |
| `gemini config set context_caching true` | Enables automatic caching of long-term project data (saves up to 90% on input). |

---

## 2. In-Session Efficiency Commands
Use these slash commands during an active coding session to manage your "Context Window."

- **`/compress`**: Summarizes the current conversation history. Use this every 10-15 prompts to prevent the input history from bloating your costs.
- **`/clear`**: Wipes the history. Use this when switching from the `/admin` panel to the `/client` dashboard to avoid sending irrelevant code in every prompt.
- **`/stats`**: Shows token usage for the last turn. Use this to identify if an agent is being "wordy" or inefficient.

---

## 3. High-Efficiency Rules for "Vibe Coding"
Add these to your project's `.gemini/rules` or project-level `README.md` to guide subagents like `@generalist`.

### **Rule 1: Strict File Scoping**
*Instruction:* "Only read the files explicitly mentioned. Do not perform a recursive search or read the entire directory unless I use the keyword 'codebase-wide'."
* **Why:** Prevents the agent from scanning your entire `node_modules` or unrelated components.

### **Rule 2: Concise Output Mode**
*Instruction:* "Do not explain code unless I ask 'Why?'. Only provide the code diffs or the specific functions that changed. Use comments inside the code for brief explanations."
* **Why:** You pay for every word the AI writes. Explanations can often cost more than the code itself.

### **Rule 3: Library Knowledge Anchoring**
*Instruction:* "I am using Next.js App Router, Tailwind CSS, and Supabase. Assume I have these installed. Do not provide installation instructions or boilerplate setup unless requested."
* **Why:** Saves tokens by skipping the "How to install Tailwind" intro.

### **Rule 4: The "Plan-First" Protocol**
*Instruction:* "Before writing any code, provide a 1-sentence plan. Wait for my confirmation."
* **Why:** Prevents the agent from writing 2,000 tokens of the *wrong* code.

---

## 4. Specific Stack Optimizations

### **Tailwind CSS**
- **Command:** `gemini config set thinking_level minimal`
- **Instruction:** "When styling, only return the modified Tailwind classes, not the entire component."

### **Supabase & Database**
- **Instruction:** "Refer to `supabase/types.ts` for all database schemas. Do not guess table structures."
- **Why:** Prevents hallucinations that lead to error-correction loops (which cost tokens).

### **Next.js & React**
- **Instruction:** "Default to Client Components (`'use client'`) only when necessary. Use Server Components by default."
- **Why:** Keeps the logic clean and prevents the AI from over-complicating state management.

---

## 5. Token Math ($20 Budget)
- **Flash Input:** ~$0.075 per 1M tokens (with caching).
- **Flash Output:** ~$0.30 per 1M tokens.
- **Efficiency Goal:** Keep your prompts under 10k tokens by using `/clear` and `/compress` frequently. This allows for over **2,000 interactions** on a $20 budget.
