# 🚗 Washboard - Complete Guide for Car Wash Owners

**Welcome to Washboard!** This guide will help you understand and use your new digital queue management system.

---

## 📖 Table of Contents

1. [What is Washboard?](#what-is-washboard)
2. [How It Replaces Pen and Paper](#how-it-replaces-pen-and-paper)
3. [Getting Started](#getting-started)
4. [Daily Operations](#daily-operations)
5. [Common Scenarios](#common-scenarios)
6. [Troubleshooting](#troubleshooting)
7. [Tips for Success](#tips-for-success)

---

## What is Washboard?

Washboard is a **browser-based queue management system** that replaces your paper logbook with a digital solution accessible from any device with internet access.

### What Problems Does It Solve?

**Before Washboard (Pen and Paper):**
- ❌ Lost or damaged logbooks
- ❌ Unclear handwriting
- ❌ No way to contact customers when ready
- ❌ Manual queue reordering when customers are late
- ❌ Customers must physically wait at your shop
- ❌ No record of daily bookings

**With Washboard:**
- ✅ All bookings stored safely online
- ✅ Clear, typed information
- ✅ Optional Facebook Messenger notifications
- ✅ Easy drag-and-drop queue management
- ✅ Customers can book remotely and come when ready
- ✅ Full history and analytics

---

## How It Replaces Pen and Paper

### Traditional Process

```
1. Customer walks in
2. You write: Name, Plate #, Car Model in logbook
3. Tell customer: "You're #5 in line, come back in 2 hours"
4. Customer leaves, might not return
5. You manually cross out names when done
```

### Washboard Process

```
1. Customer walks in (or sends Facebook message)
2. You create a "Magic Link" (takes 10 seconds)
3. Customer scans QR code or clicks link
4. They fill in their car details on their phone
5. System automatically adds them to queue
6. You manage queue from your dashboard
```

**Key Difference:** Customer does the data entry on their phone, reducing your workload!

---

## Getting Started

### Your First Login

1. **Open Your Browser**
   - Chrome, Firefox, Safari, or Edge
   - On phone, tablet, or computer
   
2. **Go to Your Link**
   - Your developer will provide: `https://washboard.ithinkandicode.space`
   - Bookmark this page!

3. **Login Credentials**
   - Branch Code: `MAIN` (or your custom code)
   - Username: `[your-username]`
   - Password: `[your-password]`
   
   ⚠️ **Keep these safe!** Anyone with these can access your queue.

### What You'll See

After logging in, you'll see the **Dashboard** with:

- **Shop Status Toggle** - Open/Closed button (top)
- **Queue Tabs** - Queued, In Service, Done, Cancelled
- **Bookings Table** - List of all cars
- **Navigation** - Link to Magic Links page

---

## Daily Operations

### Opening for the Day

1. **Login** to your dashboard
2. Check **Shop Status** at the top
3. If closed, click **"Reopen Shop"** button
4. Status will show: 🟢 **Shop Open - Accepting Bookings**

### Creating Magic Links (For Walk-In Customers)

**When a customer walks in:**

1. Click **"Magic Links"** in top navigation
2. Click **"🔗 Generate Magic Link"**
3. *Optional:* Enter customer name and Messenger handle
4. Click **"Generate"**
5. **Show QR Code** to customer to scan with their phone
6. *OR* Click **"Copy"** and send link via Messenger

**What happens next:**
- Customer opens link on their phone
- They see a form to fill in:
  - License Plate (required)
  - Car Make (required)
  - Car Model (required)
  - Name (optional)
  - Messenger (optional)
  - Notes (optional)
- They click "Submit Booking"
- **Booking appears in your queue automatically!**

### Managing the Queue

Your dashboard shows all bookings in tabs:

#### **Queued Tab** (Active Queue)
- Shows position numbers (#1, #2, #3...)
- Shows estimated wait time
- This is your active queue

**Actions you can take:**
- **Start** - Move car to "In Service" when washing begins
- **Cancel** - Remove booking (must select reason)
- **↑ Move Up** - Prioritize a customer
- **↓ Move Down** - Delay a customer

#### **In Service Tab**
- Cars currently being washed
- **Action:** Click **"Complete"** when done

#### **Done Tab**
- Completed bookings (history)
- No actions needed

#### **Cancelled Tab**
- Shows cancelled bookings with reasons
- Helps track why customers don't show up

### Closing for the Day

1. Click **"Close Shop"** button
2. Select a reason:
   - Full queue / No available slots
   - Under maintenance
   - Power outage
   - Water supply issue
   - Staff shortage
   - Weather interruption
   - Closed early
   - Holiday / Special event
3. Click **"Confirm Close"**

**Result:** New bookings are blocked. Existing queue remains visible.

---

## Common Scenarios

### Scenario 1: Customer Arrives Early

**Problem:** Customer #5 arrives before customer #3

**Solution:**
1. Find customer #5 in queue
2. Click **"↑ Move Up"** repeatedly until they're #1
3. Click **"Start"** to begin washing

### Scenario 2: Customer Doesn't Show Up

**Problem:** Customer #2 hasn't arrived after 30 minutes

**Solution:**
1. Find their booking
2. Click **"Cancel"**
3. Select reason: "Customer no-show"
4. Click **"Confirm"**
5. Queue automatically reorders

### Scenario 3: Rush Hour - Full Queue

**Problem:** Too many customers, need to close temporarily

**Solution:**
1. Click **"Close Shop"**
2. Select: "Full queue / No available slots"
3. Existing customers can still track their position
4. New bookings are blocked
5. When ready: Click **"Reopen Shop"**

### Scenario 4: Multiple Cars for One Customer

**Problem:** Customer wants to wash 2 cars

**Solution:**
1. Create 2 separate Magic Links
2. Customer fills out form twice (different plates)
3. Both appear as separate bookings in queue

### Scenario 5: Emergency Closure (Power/Water)

**Problem:** Sudden power outage, need to close immediately

**Solution:**
1. Click **"Close Shop"**
2. Select reason: "Power outage" or "Water supply issue"
3. **Contact customers** via Messenger (if they provided handles)
4. When resolved: Click **"Reopen Shop"**

---

## Troubleshooting

### "I can't login"

**Check:**
- ✓ Correct branch code? (Usually `MAIN`)
- ✓ Username is lowercase?
- ✓ Password is correct? (case-sensitive)
- ✓ Internet connection working?

**If still stuck:** Contact your developer.

### "Booking disappeared from queue"

**Possible reasons:**
- You or someone else marked it "Done" or "Cancelled"
- Check **"Done"** or **"Cancelled"** tabs

**Prevention:** Be careful with button clicks!

### "Customer can't access magic link"

**Check:**
- ✓ Link was copied completely? (very long URL)
- ✓ Link hasn't expired? (valid for 24 hours)
- ✓ Link wasn't already used?
- ✓ Customer has internet connection?

**Solution:** Generate a new magic link.

### "Dashboard isn't updating"

**The system auto-refreshes every 10 seconds.**

**Manual refresh:**
- Press `F5` on keyboard
- Or click browser refresh button

### "I clicked wrong button (accidental Complete/Cancel)"

**Currently:** Cannot undo. Be careful!

**Best practice:** 
- Double-check before clicking
- Keep queue tab visible to avoid mistakes

---

## Tips for Success

### For Your Staff

**Train your receptionists on:**
1. How to create magic links (practice 10 times)
2. When to use Move Up/Down (customer prioritization)
3. How to handle cancellations (always select correct reason)
4. How to close/reopen shop properly

**Create a cheat sheet** with:
- Login credentials
- "Generate Magic Link" steps (with screenshots)
- Common scenarios and solutions

### For Your Customers

**Promote the new system:**
- "We now accept online bookings!"
- "Scan QR code to join queue from anywhere"
- "Get Messenger notifications when ready"

**Post signs:**
- At entrance: "Scan to join queue"
- At cashier: QR code display
- On Facebook: "Click here to book: [your link]"

### Best Practices

**Daily:**
- ✅ Check shop status is "Open" in morning
- ✅ Clear old "Done" bookings weekly (for speed)
- ✅ Monitor queue length during rush hours

**Weekly:**
- ✅ Review "Cancelled" reasons (spot patterns)
- ✅ Check if customers are using Messenger notifications
- ✅ Backup any important customer data

**Monthly:**
- ✅ Change your password
- ✅ Review system performance with developer
- ✅ Suggest improvements based on usage

### Security Reminders

**DO:**
- ✅ Logout when leaving your device unattended
- ✅ Keep login credentials private
- ✅ Use strong passwords (12+ characters)
- ✅ Logout from public devices (internet cafes)

**DON'T:**
- ❌ Share your password with customers
- ❌ Leave dashboard open on customer-facing screens
- ❌ Use same password for other websites
- ❌ Write password on paper near your computer

---

## Need More Help?

### Quick Reference Card

Print and laminate this:

```
WASHBOARD QUICK REFERENCE

LOGIN: https://washboard.ithinkandicode.space
Branch: MAIN | User: [your-user] | Pass: [your-pass]

CUSTOMER ARRIVES:
1. Magic Links → Generate
2. Show QR code or send link
3. Customer fills form on phone

MANAGE QUEUE:
- Start = Begin washing
- Complete = Finished
- Cancel = No-show (select reason)
- Move Up/Down = Change order

CLOSE SHOP: Click "Close Shop" → Select reason

OPEN SHOP: Click "Reopen Shop"

HELP: Contact [developer name/number]
```

### Contact Your Developer

**For technical issues:**
- Email: [developer email]
- Phone: [developer number]

**For training requests:**
- Schedule a 1-hour refresher session
- Request custom features

---

## Summary

Washboard replaces your **paper logbook** with a **digital queue system** that:
- Saves you time (customers enter their own data)
- Reduces errors (no illegible handwriting)
- Improves customer experience (remote booking, notifications)
- Provides business insights (track cancellations, busy hours)

**Most important:** The system is designed to be **simple and intuitive**. If something feels complicated, it probably is - ask your developer to simplify it!

---

**Document Version:** 1.0 (November 2025)  
**For technical documentation, see:** `washboard-app/README.md`  
**System Status:** ✅ Production Ready  
**Live System:** https://washboard.ithinkandicode.space
