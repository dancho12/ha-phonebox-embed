# PhoneBox embed for Home Assistant

**English** · [Русский](README.ru.md)

A dashboard module that fits a Home Assistant dashboard into the **Home Assistant dashboard** widget of
[PhoneBox](https://github.com/ersinkoc/phonebox) (a desk panel on an old phone), or into any other app that shows
Home Assistant in a frame.

On a dashboard where it is turned on:

- **The PhoneBox grid.** Cards are laid out on a 12 × 6 grid over the whole widget. A 6 × 2 card is exactly half the
  width and a third of the height, so there is no size fiddling. The columns apply in the editor on your computer
  too, so the sizes you pick there are the ones the panel shows.
- **No background of its own.** The page is transparent and the PhoneBox background shows through. Any theme works.
- **No outer padding.** The PhoneBox card already has its own.

The background, padding and row height change only while the dashboard is shown inside a frame. The same dashboard
in a browser or in the Companion app looks as usual.

## Setup, step by step

### 1. A user for the panel

The panel signs in to Home Assistant as a user, so give it one of its own, without administrator rights.

**Settings › People › Users › Add user**, for example "Panel". Turn on **Can only log in from the local network**;
leave **Administrator** off.

### 2. Sign in without a password

The phone should sign in by itself. For that, Home Assistant trusts the phone's address.

1. Give the phone a fixed address in your router (a DHCP reservation), for example `192.168.1.50`.
2. Find the user's id: turn on **Advanced mode** in your profile, then **Settings › People › Users** › "Panel".
   The dialog shows the id.
3. Add to `configuration.yaml`:

   ```yaml
   homeassistant:
     auth_providers:
       - type: trusted_networks
         trusted_networks:
           - 192.168.1.50/32           # the phone only
         trusted_users:
           192.168.1.50: abcdef0123456789   # the "Panel" user's id
         allow_bypass_login: true
       - type: homeassistant           # the usual password sign-in for everyone else; keep it
   ```

4. Restart Home Assistant.

If you'd rather not trust an address, sign in once inside the widget on the phone; Home Assistant remembers it.

### 3. Allow Home Assistant in a frame

By default Home Assistant refuses to be shown inside another app (the `X-Frame-Options` header). Add to
`configuration.yaml` and restart:

```yaml
http:
  use_x_frame_options: false
```

This lets other pages embed Home Assistant. Keep that in mind if your Home Assistant is reachable from the internet;
on a home network only, it does not matter.

### 4. Install the module

**Home Assistant 2026.11 and later (Marketplace):**

1. **Settings › Marketplace › ⋮ › Add from link**: `https://github.com/dancho12/ha-phonebox-embed`, type
   **Dashboard**. The Marketplace needs a connected GitHub account for this.
2. Find **PhoneBox embed** and install it. The dashboard resource is added for you.

**Before 2026.11 (HACS):** **HACS › ⋮ › Custom repositories**, the same link, type **Dashboard**; then install
**PhoneBox embed**.

**By hand:** put `ha-phonebox-embed.js` in `/config/www/` and add a resource in **Settings › Dashboards › ⋮ ›
Resources › Add resource**: URL `/local/ha-phonebox-embed.js?v=1.0.0`, type **JavaScript module**. Change `?v=` when
you update the file.

Then reload the page with a cache refresh (Ctrl+Shift+R).

### 5. A dashboard for the panel

1. **Settings › Dashboards › Add dashboard › New dashboard from scratch**, for example "PhoneBox" (URL
   `phonebox-panel`).
2. Open it and press the pencil. Keep the view type **Sections**. In the view's settings, set **Max number of
   sections wide** to **1** and make one section. Put your cards in it.
3. **⋮ › Raw configuration editor** and add at the top level, next to `views:`:

   ```yaml
   phonebox:
     columns: 12   # columns across the full width, as in PhoneBox
     rows: 6       # rows over the full height of the widget
   ```

   A view can have numbers of its own:

   ```yaml
   phonebox:
     columns: 12
     rows: 6
     views:
       climate: { rows: 4 }   # the view's path or its index
   ```

4. Save. A card's size (**Layout** in its settings) is now in panel cells, 12 columns by 6 rows: 6 × 2 is half the
   width and a third of the height.

More section columns, and sections wider than one, work too: the module takes the grid from the view's full width.
One column is the simplest: what the editor shows is what the panel shows.

### 6. Hide the header and sidebar (kiosk-mode)

To show the panel without Home Assistant's header and sidebar, install
[kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (from the Marketplace or HACS) and add to the dashboard's YAML:

```yaml
kiosk_mode:
  user_settings:
    - users: ["Panel"]   # the user from step 1
      kiosk: true
```

Only the panel's user then gets the kiosk view; on your computer the dashboard keeps its header and stays editable.
Without kiosk-mode the header takes the top of the widget and 6 rows no longer fit.

### 7. The PhoneBox widget

1. **PhoneBox › Settings › General › Home Assistant**: the address and a long-lived access token, if they are not
   there yet. The token stays on the computer: it lists the dashboards in Settings and is never sent to the phone.
2. Add the **Home Assistant dashboard** widget to a page, usually the whole page (12 × 6).
3. **Dashboard and view**: pick one from the list, for example `phonebox-panel/home`.
4. **Address from the phone**: leave it empty when the phone reaches Home Assistant at the same address as the
   computer. When Settings has `localhost` or `homeassistant.local` (Android often cannot resolve `.local` names),
   enter the IP address, for example `http://192.168.1.10:8123`.
5. Save.

## Troubleshooting

| What you see | What to do |
|---|---|
| An empty widget | Step 3: `use_x_frame_options: false`, restart Home Assistant |
| Home Assistant's sign-in page | Step 2: the phone's address in `trusted_networks` and the user's id, or sign in once in the widget |
| "Home Assistant does not answer" | Address from the phone (step 7.4): an IP address instead of `.local`, the phone on the same network |
| The usual grid, no transparent background | The module is not loaded: check the resource (step 4) and reload with a cache refresh. The browser console shows a `PHONEBOX-EMBED` line when it is |
| The grid, but rows do not fill the height | Home Assistant's header is showing: step 6 (kiosk-mode) |
| No pictures (album art, photos) over `http` | Use a PhoneBox version that has the Home Assistant dashboard widget: its panel does not block `http` pictures |

## How it works

The module computes nothing in JavaScript; it only sets Home Assistant's own CSS variables:

- `--base-column-count` in a section's grid: `columns / the view's column count`, so a section as wide as the view
  gets `columns` cells;
- `--ha-section-grid-row-height`: `(100vh − the gaps) / rows` (inside a frame, `100vh` is the widget's height);
- transparency: the backgrounds of the page, the panel and the view.

The styles go into the shadow DOM of Home Assistant's components, so the module finds them on the page and keeps
them in place while such a dashboard is open. Other dashboards are left alone.

MIT license.
