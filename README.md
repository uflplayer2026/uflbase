# UFL Card Showcase

Build a real, production-quality UFL Mobile Player Card Database web app.

IMPORTANT: For this first phase, build ONLY the Google Sheets → website data flow and the basic player-card display.

Do NOT build yet:

- Admin Settings
- Google Login
- advanced authentication
- search
- filters
- sorting
- manual editing
- scanner
- payments
- separate database
- fake/mock/demo data

1. GOOGLE SHEETS IS THE SOURCE OF TRUTH

The existing Google Sheet is the ONLY source of player-card data.

Connect the app to Google Sheets using Lovable's official Google Sheets connector/integration.

Do not create a separate database that duplicates the player-card records.

Do not hard-code player data.

Do not generate example players.

If the Google Sheet cannot be connected, show a clear configuration/error state instead of fake data.

2. EXISTING SHEET STRUCTURE

The Sheet contains exactly these 12 columns in this exact order:

1. Player Name
2. OVR
3. Position
4. Nation
5. PAC
6. SHO
7. PAS
8. DRI
9. DEF
10. PHY
11. Perk
12. Card Image

Use this exact fixed order.

Do NOT add any fields.

Do NOT create:

- Skills
- Club
- Event
- Release Date
- Rarity
- Price
- Market Value

Multiple rows with the same player name are valid separate cards.

Do not merge them.

3. DATA MODEL

Map each Sheet row to:

playerName
ovr
position
nation
pac
sho
pas
dri
def
phy
perk
cardImage

Missing cells must remain empty.

Never guess missing values.

Numeric fields:
OVR, PAC, SHO, PAS, DRI, DEF, PHY.

Text fields:
Player Name, Position, Nation, Perk, Card Image.

4. PLAYER CARD

Create ONE reusable component called:

PlayerCard

Every displayed player must use this same component.

The card should have a polished UFL Mobile-inspired football-card appearance without copying official copyrighted assets.

Show ONLY:

Player Name
OVR
Position
Nation
PAC
SHO
PAS
DRI
DEF
PHY
Perk
Card Image

If Card Image is empty, show a neutral placeholder area.

Never invent a player image.

5. DATABASE PAGE

Create a simple "/cards" page.

It should:

1. Load the real Google Sheet data.
2. Display the records as PlayerCard components.
3. Show a loading state while data is loading.
4. Show a clear error state if Google Sheets cannot be read.
5. Show an empty state if there are no records.

Do not display mock data at any point.

Use a responsive grid:

- mobile: approximately 2 cards per row
- tablet: 3–4
- desktop: 4–6

Keep card proportions consistent.

6. HOME PAGE

Create a simple "/" page.

It should contain:

Title:
"UFL Mobile Player Card Database"

Short description:
"Community-made UFL Mobile player card database."

Show a small selection of REAL records loaded from Google Sheets.

Do not create demo records.

7. DESIGN

Use one coherent visual system:

- dark/futuristic football aesthetic
- premium card appearance
- clean typography
- strong contrast
- subtle gradients
- polished spacing
- mobile-first layout

Do not create unrelated visual styles.

8. IMPORTANT

The primary acceptance test for this phase is:

GOOGLE SHEET
↓
LOVABLE GOOGLE SHEETS CONNECTOR
↓
REAL SHEET RECORD
↓
PlayerCard
↓
VISIBLE ON WEBSITE

Do not proceed to additional features until this real data flow works.

After implementation, verify that at least the existing real Sheet records can be loaded and rendered.

If the Google connector requires user authorization or configuration, tell me exactly what I need to click/configure.

Do NOT replace the real integration with mock data if something fails.

Keep the implementation modular so authentication, Admin Settings, Sync, search, filters and sorting can be added later without rebuilding the PlayerCard component.

Start with this MVP only.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://uflbase.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f7761f23-89a9-40c2-a6fd-254882081b85).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
