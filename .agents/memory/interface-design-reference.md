---
name: Interface Design Reference
description: PDF se liye gaye register aur master form interface designs — UI banate waqt in ko base banao.
---

## General Style

- **Theme:** Dark background (near-black), light text
- **Toolbar pattern (har form mein):** Refresh | Save | Update | Delete | Exit — top mein icon + label
- **Date:** Top-right corner mein automatically show hoti hai
- **Language:** Fields ke labels English mein, kuch Urdu (تہان، شکنجہ، جمع، بنام)

---

## 1. Add Product Form

**Fields (left to right, top to bottom):**
- Item ID (text input + "? Search" button)
- Bar Code ID (text input)
- Item Name (text input)
- Urdu Name (text input)
- Volume (dropdown)
- Scale (dropdown)
- QTY: 0 | تہان: 0 | میٹر: 0 (quantity inputs)

**Toolbar:** Refresh | Save | Update | Delete | Exit

---

## 2. Add Purchase Party Form

**Fields:**
- Main A/C (short numeric input, e.g. "1")
- A/C Name (text, e.g. "Credit Purchase")
- ID (short numeric, e.g. "24")
- Name (text input)
- Urdu Name (text input)
- Address (larger text input)
- City (dropdown) | شکنجہ (dropdown)
- Ph# (text) | Mobile # (text)
- Opening Credit: 0 | Opening Debit: 0
- جمع | بنام labels

**Note:** A/C Name field mein "Credit Purchase" default show hota hai.

---

## 3. Add Sale Party Form

**Same layout as Purchase Party** with differences:
- Main A/C = 2
- A/C Name = "Credit Sale" — **YEH FIELD DROPDOWN HOGI (Cash / Credit)**
  - PDF note: "Bs jehan A/C likha ho Wehan Droup Down ho Cash or Credit ka"
- Opening Credit / Opening Debit same

---

## 4. Add Shikanja Form

**Same layout as Purchase/Sale Party** with:
- Main A/C = 3
- A/C Name = "Shikanja"
- Same general fields (Name, Urdu Name, Address, City, Ph#, Mobile#, Opening Credit/Debit)

---

## 5. Purchase Gate Pass Register

**Header section (top):**
- Serial No (auto-generated, e.g. "3212") + Search button
- G.P. # field
- Party Code | Name (dropdown with smart search) | Ph# | Department | City

**Item entry row (single row input area):**
- Item Code | Item Name | Stock | UOM | QTY | Meter | تہان | Rate | AMOUNT

**Items grid (below entry row):**
Columns: Item Code | Description | Scale | QTY | MTR | تہان | Rate | Amount
- "← Item Delete" button on right side

**Summary (bottom-right):**
- TOTAL
- QTY:
- MTR:
- Rs:

**Toolbar:** Refresh | Save | Update | Cancel | Delete | Print + Date (top-right)

---

## 6. Sale Gate Pass Register

**Header section:**
- Bill No (e.g. "5469") + Search | New Party button
- G.P. # | Stock (dropdown) | شکنجہ (dropdown — top right)
- Second row: Party info | Ph# | Dept | City | No Of Bags | **Balance** (highlighted green/colored)

**Items grid columns:**
Description | Scale | QTY | Meter | تہان | Rate | Amount | Disc Rate | Disc Rs | Net Bill

**Note field:** "Zarorori Note / Refrence ke liye" — right side mein ek note box

**"← Item Delete" button**

**Summary (bottom-right):**
- QTY:
- Meters:
- Sub:
- Disc:
- Total:

**Toolbar:** Cancel | Refresh | Save | Update | Delete | Print | J.V | New Party + Date

---

## 7. Return Gate Pass Register

**Same layout as Sale Gate Pass Register** — identical structure.
- Same toolbar
- Same header fields
- Same items grid (Description | Scale | QTY | Meter | تہان | Rate | Amount | Disc Rate | Disc Rs | Net Bill)
- Same summary (QTY, Meters, Sub, Disc, Total)

---

## Key UI Patterns to Remember

1. **Every register has two zones:** Header (party/date info) + Items Grid (product rows)
2. **Item Delete button** is always on the right side of the grid
3. **Summary totals** always bottom-right
4. **Balance field** in Sale/Return GP is highlighted (colored text) — shows party balance
5. **Smart Search** on Party and Product fields (type few letters → dropdown suggestions)
6. **Toolbar always at top** with icon + text label below icon
7. **Dark theme throughout** — consistent across all forms
8. **No Of Bags** field in Sale/Return GP header
9. **J.V button** in Sale/Return GP toolbar (Journal Voucher)
10. **"New Party" button** in Sale/Return GP toolbar — quick party creation
