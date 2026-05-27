# GTA Wedding Vendor Portal — Golden Glance Studio

A curated wedding vendor directory for the Greater Toronto Area, featuring venues, bakeries, and florists with budget filtering, map view, and list view.

---

## 🚀 DEPLOYMENT GUIDE (Step by Step)

### What You Need First

1. **A GitHub account** — free at https://github.com
2. **A Vercel account** — free at https://vercel.com (sign up with your GitHub account)
3. **Node.js installed** — download from https://nodejs.org (LTS version)
4. **Git installed** — download from https://git-scm.com

---

### STEP 1: Upload This Project to GitHub

**Option A — Using GitHub.com (no terminal needed):**

1. Go to https://github.com/new
2. Name it `gta-wedding-vendors`
3. Set it to **Public**
4. Click **"Create repository"**
5. On the next page, click **"uploading an existing file"**
6. Drag the entire contents of this folder into the upload area
7. Click **"Commit changes"**

**Option B — Using the terminal:**

```bash
cd gta-vendor-portal
git init
git add .
git commit -m "Initial commit - GTA Wedding Vendor Portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gta-wedding-vendors.git
git push -u origin main
```

---

### STEP 2: Deploy on Vercel (Free)

1. Go to https://vercel.com and log in with GitHub
2. Click **"Add New..." → "Project"**
3. Find your `gta-wedding-vendors` repo and click **"Import"**
4. Vercel auto-detects Vite — just click **"Deploy"**
5. Wait ~60 seconds. Done! Your site is live at something like:
   `https://gta-wedding-vendors.vercel.app`

**Optional: Custom domain**
- In Vercel → Settings → Domains, you can add a custom domain like `vendors.goldenglancestudio.com`
- Vercel will give you DNS records to add to your domain provider

---

### STEP 3: Embed on Your Squarespace Site

1. In your Squarespace dashboard, go to **Pages** → **Add Page** → **Blank Page**
2. Name it something like "Vendor Directory" or "Wedding Vendors"
3. Add a **Code Block** (click + → Code)
4. Paste this HTML:

```html
<div style="width:100%; margin:0 auto;">
  <iframe
    src="https://gta-wedding-vendors.vercel.app"
    width="100%"
    height="900"
    frameborder="0"
    style="border:none; border-radius:12px;"
    loading="lazy"
    title="GTA Wedding Vendor Directory">
  </iframe>
</div>
```

5. Toggle **"Display Source"** OFF
6. Save and publish

**Important:** Replace the `src` URL with your actual Vercel URL.

**To add it to your navigation menu:**
- Go to Squarespace → Pages → drag your new page into the Main Navigation section

---

## 🔧 HOW TO ADD/EDIT VENDORS

Open `src/WeddingVendorPortal.jsx` and find the `VENDORS` array at the top. Add a new vendor like this:

```javascript
{
  id: 50,                          // unique number
  name: "New Vendor Name",
  category: "venue",               // "venue", "bakery", or "florist"
  region: "Toronto",               // must match one in REGIONS array
  lat: 43.6532,                    // Google Maps latitude
  lng: -79.3832,                   // Google Maps longitude
  priceRange: "$3,000–$8,000",     // display text
  budgetMin: 3000,                 // numeric for filter (lowest price)
  budgetMax: 8000,                 // numeric for filter (highest price)
  packages: "Description of what they offer",
  phone: "(416) 555-1234",         // or "N/A"
  website: "https://vendor-site.com",
  rating: 4.5                      // out of 5
},
```

**To find latitude/longitude:**
1. Go to Google Maps
2. Right-click the vendor's location
3. The first option shows coordinates — click to copy

After editing, push to GitHub and Vercel auto-deploys in ~60 seconds.

---

## 📁 Project Structure

```
gta-vendor-portal/
├── index.html              ← Entry HTML
├── package.json            ← Dependencies
├── vite.config.js          ← Build config
├── vercel.json             ← Vercel deploy config
├── public/
│   └── favicon.svg         ← Browser tab icon
└── src/
    ├── main.jsx            ← React entry point
    └── WeddingVendorPortal.jsx  ← THE APP (edit vendors here)
```

---

## 💡 Tips

- **Updating vendors**: Edit `WeddingVendorPortal.jsx`, push to GitHub, Vercel auto-deploys
- **Adding categories**: Add to the `CATEGORIES` array and `CAT_COLORS` object
- **Adding regions**: Add to the `REGIONS` array
- **Budget presets**: Edit the `BUDGET_PRESETS` array to change budget ranges
- **Styling**: Colors use your Golden Glance Studio gold (#D4AF37) on dark theme

---

Built for Golden Glance Studio · goldenglancestudio.com
