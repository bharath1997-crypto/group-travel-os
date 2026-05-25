# 🔎 Splitwise Full Feature & Operational Audit Report

This report presents a thorough, button-by-button functional breakdown of **Splitwise** based on our interactive browser audit session. It serves as a feature blueprint for expanding the capabilities of **Rovvy Splits**.

---

## 🛠️ Section 1: Dashboard Header & Global Controls

### 1. Unified Balance Triad
* **Features & Actions**:
  * Displays three primary numbers: **Total Balance**, **You Owe**, and **You Are Owed**.
  * Dynamic Currency Indicator flags: When transactions involve multiple currencies (e.g. `USD`, `INR`, `EUR`), a notice highlights that multiple currencies are active rather than attempting a forced addition.
* **Operational Rules**:
  * Displays a positive total balance in green (`#2ECC71` or `#5BC5A7`).
  * Displays negative total balances (debts) in coral-red (`#E94560`).

### 2. View Toggle (List View vs. Chart View)
* **Features & Actions**:
  * Located at the top right of the dashboard.
  * **List View Button**: Renders a vertical list showing detailed individual debts per contact.
  * **Chart View Button**: Opens a horizontal bar chart mapping balances. Positive amounts extend right in green, and negative amounts extend left in orange-red.

---

## 🎚️ Section 2: Advanced Split Option Tabs & Calculations

When adding or editing an expense, clicking on the **Split Type Selector** triggers a tabbed interface containing seven advanced mathematical splitting methods:

### 1. Equally (`=`)
* **Behavior**: Divides the total cost equally among selected members.
* **Formula**: `Share = Total / N` (where `N` is the number of checked participants). Resolves any rounding discrepancies (e.g. splitting $10.00 among 3 people resolves to $3.34 for the payer and $3.33 for others).

### 2. Exact Amounts (`1.23`)
* **Behavior**: Allows entering specific dollar amounts per person.
* **Validation**: Displays a dynamic status label: `USD X.XX of USD Y.YY remaining` or `USD X.XX over limit` to ensure the sum of individual entries exactly matches the total amount.

### 3. Percentages (`%`)
* **Behavior**: Allocates costs based on percentage entries.
* **Validation**: Displays `X% of 100% remaining` or `X% over limit`. The "Save" action is disabled until the total sum equals exactly `100%`.

### 4. Shares (Weighted Bars)
* **Behavior**: Divides costs using integer shares or parts (e.g., A has 2 shares, B has 1 share, C has 1 share; A pays 50%, B pays 25%, C pays 25%).
* **Use Case**: Perfect for family plans or lodging where some rooms are larger.

### 5. Adjustments (`+/-`)
* **Behavior**: Performs an equal split first, then allows adding or subtracting positive/negative offset adjustments per person (e.g. equal split is $15, but A gets a +$5 adjustment for extra drinks, and B gets a -$3 adjustment for skipping dessert).

### 6. Reimbursement (Money Bag)
* **Behavior**: Records cash payments or direct bank transfers where one person is paying back another, resolving debts without creating new shared expenses.

### 7. Itemized Split (Bullet List)
* **Behavior**: The most advanced calculator. Supports line-by-line receipt splitting:
  * Adds items with individual names and costs.
  * Assigns specific guests to specific line items.
  * Inputs global **Tax** & **Tip** (absolute value or percentage).
  * Automatically calculates proportional tax and tip splits based on each person's itemized consumption.

---

## 🕸️ Section 3: Group Balance Netting & Debt Simplification

### 1. The Simplification Concept
* **Feature**: Located in Group Settings under the toggle `"Simplify Group Debts"`.
* **The Math**: Implements a netting algorithm (directed acyclic graph minimization). 
  * If **User A owes User B $20**, and **User B owes User C $20**, the system simplifies this to: **User A pays User C $20**.
  * Reduces transaction overhead and minimizes transfer fees.

### 2. Remind & Request Actions
* **Feature**: Under the expanded details of simplified group debts, clicking **"Remind"** triggers automated email notifications or push alerts to request outstanding payments.

---

## 🧮 Section 4: Fairness Calculators Suite

Accessed via the User Dropdown, this specialized suite helps roommates make fair housing agreements:

1. **Split the Rent**:
   * Evaluates bedroom sizes, private vs. shared bathrooms, closet space, and window counts to calculate room-by-room rent allocations from a total flat rate.
2. **Furniture Calculator**:
   * Computes depreciation on second-hand furniture (e.g., couches, televisions) when one roommate moves out and wants to buy out or sell back assets to the remaining household.
3. **Guest / Utilities Offsets**:
   * Calculates utility bill shares if one roommate has a guest staying over for an extended period, accounting for extra resource usage.

---

## 🗺️ Section 5: Rovvy Integration Blueprint (The Design Plan)

To elevate Rovvy to a premium, unified financial assistant, we plan to implement these features in future iterations:

| Feature Plan | UI Implementation | Technical Stack |
| :--- | :--- | :--- |
| **Rent & Room Allocation Calculator** | Integrated within the **Hotels/Accommodations** page for travel groups. | React local calculators using Outfit typography. |
| **Proportional Itemized Splitting** | An interactive list selector when splitting restaurant bills or transport extras. | Local calculation engine inside `AddExpenseSheet`. |
| **Debt Simplification Netting** | A simple toggle on the Splits page showing simplified direct payments. | Backend directed graph resolution service. |
