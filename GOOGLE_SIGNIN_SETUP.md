# Google Sign-In Setup Guide

This guide walks you through setting up Google Sign-In for the "Did Kanye Tweet This?" app.

## Prerequisites

- A Google account
- The app files served from a web server (not `file://` protocol)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click **New Project**
4. Enter a project name (e.g., "Kanye Tweet Game")
5. Click **Create**
6. Wait for the project to be created, then select it

---

## Step 2: Configure the OAuth Consent Screen

Before creating credentials, you need to configure how your app appears to users.

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (unless you have a Google Workspace organization)
3. Click **Create**
4. Fill in the required fields:
   - **App name**: `Did Kanye Tweet This?`
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **Save and Continue**
6. On the **Scopes** page, click **Save and Continue** (no additional scopes needed)
7. On the **Test users** page:
   - Click **Add Users**
   - Add your email address (and any other testers)
   - Click **Save and Continue**
8. Review and click **Back to Dashboard**

> ⚠️ **Note**: While in "Testing" mode, only users you add as test users can sign in. To allow anyone to sign in, you'll need to publish the app (Step 5).

---

## Step 3: Create OAuth 2.0 Credentials

1. In the left sidebar, go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** at the top
3. Select **OAuth client ID**
4. For **Application type**, choose **Web application**
5. Enter a name (e.g., "Kanye Tweet Game Web Client")
6. Under **Authorized JavaScript origins**, add your origins:

   **For local development:**
   ```
   http://localhost:5500
   http://127.0.0.1:5500
   http://localhost:3000
   http://localhost:8080
   ```

   **For production:**
   ```
   https://yourdomain.com
   ```

   > 💡 Add the port number your local server uses. VS Code Live Server typically uses 5500.

7. Leave **Authorized redirect URIs** empty (not needed for this implementation)
8. Click **Create**
9. A popup will show your **Client ID** - copy it!

---

## Step 4: Add Your Client ID to the App

1. Open `index.html` in your editor
2. Find this line (around line 20):
   ```html
   data-client_id="YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"
   ```
3. Replace `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID
4. Save the file

**Example:**
```html
data-client_id="123456789-abcdefghijklmnop.apps.googleusercontent.com"
```

---

## Step 5: Test Your App

### Option A: Using VS Code Live Server (Recommended)

1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select **Open with Live Server**
4. The app will open at `http://127.0.0.1:5500`

### Option B: Using Python

```bash
# Python 3
python -m http.server 8080

# Then open http://localhost:8080
```

### Option C: Using Node.js

```bash
npx serve .

# Then open the URL shown in terminal
```

---

## Step 6: Publish Your App (Optional - For Public Access)

While in "Testing" status, only whitelisted test users can sign in. To allow anyone:

1. Go to **APIs & Services** → **OAuth consent screen**
2. Click **Publish App**
3. Click **Confirm**

> ⚠️ **Note**: If your app requests sensitive scopes, Google may require verification. This app only uses basic profile info, so verification is typically not required.

---

## Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Make sure the URL in your browser matches one of your **Authorized JavaScript origins**
- Check for typos, trailing slashes, or port mismatches

### "Sign in with Google" button doesn't appear
- Check browser console for errors
- Make sure you're not opening the file directly (`file://`) - use a web server
- Verify the Google Sign-In script is loading: `https://accounts.google.com/gsi/client`

### "Access blocked: This app's request is invalid"
- Your Client ID might be wrong - double-check it
- The origin might not be authorized - add it in Google Cloud Console

### Sign-in works but immediately signs out
- Check for JavaScript errors in the console
- Make sure `tweets.js` and `app.js` are loading correctly

### Only test users can sign in
- Your app is still in "Testing" mode - see Step 6 to publish it

---

## File Structure

After setup, your project should look like this:

```
kanye/
├── index.html      # Main HTML file (contains your Client ID)
├── styles.css      # All CSS styles
├── tweets.js       # Tweet data
├── app.js          # Game logic and authentication
└── GOOGLE_SIGNIN_SETUP.md  # This guide
```

---

## Security Notes

- Your Client ID is **public** - it's safe to include in frontend code
- Never expose your **Client Secret** in frontend code (we don't use it here)
- User data is stored in `localStorage` - it's per-browser and not synced

---

## Need Help?

- [Google Identity Services Documentation](https://developers.google.com/identity/gsi/web)
- [Google Cloud Console](https://console.cloud.google.com/)
- [OAuth 2.0 for Client-side Web Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
