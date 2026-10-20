"""Functional browser checks. Requires Python Playwright and system Chromium.
Run against the Vite server: python tests/browser_smoke.py
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = 'http://127.0.0.1:5174'
KEY = 'jojo-journey-v1'
ROOT = Path(__file__).resolve().parents[1]
(ROOT / 'artifacts').mkdir(exist_ok=True)

def saved(page):
    return page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1000}, timezone_id='America/Denver')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.clock.install(time=datetime(2026, 10, 22, 18, tzinfo=timezone.utc))
    page.goto(URL, wait_until='networkidle')
    expect(page.locator('.part-card')).to_have_count(9)
    expect(page.locator('.release-card.sbr')).to_contain_text('Episode 7')
    expect(page.locator('.release-card.jojolands')).to_contain_text('Chapter 42')

    phantom = page.locator('.part-card').filter(has=page.get_by_role('heading', name='Phantom Blood', exact=True))
    phantom.get_by_role('button', name='Log episode', exact=True).click()
    assert saved(page)['progress']['1']['anime'] == 1
    page.get_by_role('button', name='Undo', exact=True).click()
    assert saved(page)['progress'].get('1', {}).get('anime', 0) == 0
    phantom.get_by_role('button', name='Edit Phantom Blood progress', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('spinbutton', name='Episodes watched', exact=True).fill('9')
    dialog.get_by_role('spinbutton', name='Chapters read', exact=True).fill('44')
    dialog.get_by_label('Your notes', exact=False).fill('A favorite moment. <script>literal text</script>')
    dialog.get_by_role('button', name='Favorite', exact=True).click()
    dialog.get_by_role('button', name='Save progress', exact=True).click()
    expect(phantom.locator('.status')).to_have_text('Completed')
    state = saved(page)
    assert state['progress']['1']['favorite'] is True
    assert state['progress']['1']['manga'] == 44
    page.reload(wait_until='networkidle')
    expect(phantom.locator('.status')).to_have_text('Completed')
    page.get_by_role('button', name='Favorites 1', exact=False).click()
    expect(page.locator('.part-card')).to_have_count(1)
    page.get_by_role('button', name='My library', exact=True).click()
    page.get_by_role('textbox', name='Search parts').fill('Jolyne')
    expect(page.locator('.part-card')).to_have_count(1)
    expect(page.locator('.part-card h3')).to_have_text('Stone Ocean')
    page.get_by_role('button', name='Clear search').click()
    expect(page.locator('.part-card')).to_have_count(9)
    page.get_by_role('button', name='Completed', exact=True).click()
    expect(page.locator('.part-card')).to_have_count(1)
    page.get_by_role('button', name='All parts', exact=False).click()
    page.get_by_role('button', name='Adaptation', exact=True).click()
    expect(page.locator('.adaptation-row')).to_have_count(9)
    expect(page.locator('.coverage-ring')).to_contain_text('75')
    page.get_by_role('button', name='Update release catalog', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('spinbutton', name='Steel Ball Run adapted', exact=True).fill('12')
    dialog.get_by_role('button', name='Update catalog', exact=True).click()
    assert saved(page)['releases']['7']['adapted'] == 12

    # A future date catches up weekly and monthly releases, once only.
    page.clock.set_system_time(datetime(2026, 11, 20, 18, tzinfo=timezone.utc))
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    page.wait_for_function("JSON.parse(localStorage.getItem('jojo-journey-v1')).releases['7'].episodes === 11")
    state = saved(page)
    assert state['releases']['9']['chapters'] == 42
    assert state['progress']['1']['anime'] == 9
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    assert saved(page)['releases']['7']['episodes'] == 11
    page.reload(wait_until='networkidle')
    assert saved(page)['releases']['7']['episodes'] == 11

    page.get_by_role('button', name='Release schedule', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('checkbox', name='Steel Ball Run automatic updates').uncheck()
    dialog.get_by_role('spinbutton', name='JOJOLands monthly release day').fill('20')
    dialog.get_by_role('button', name='Save schedule', exact=True).click()
    assert saved(page)['schedules']['sbr']['enabled'] is False
    assert saved(page)['schedules']['jojolands']['nextRelease'] == '2026-12-20'
    page.clock.set_system_time(datetime(2026, 12, 20, 18, tzinfo=timezone.utc))
    page.evaluate("window.dispatchEvent(new Event('focus'))")
    page.wait_for_function("JSON.parse(localStorage.getItem('jojo-journey-v1')).releases['9'].chapters === 43")
    assert saved(page)['releases']['7']['episodes'] == 11
    page.get_by_role('button', name='Release schedule', exact=True).click()
    dialog = page.get_by_role('dialog')
    dialog.get_by_role('checkbox', name='Steel Ball Run automatic updates').check()
    dialog.get_by_role('button', name='Save schedule', exact=True).click()
    assert saved(page)['schedules']['sbr']['nextRelease'] == '2026-12-25'
    assert saved(page)['releases']['7']['episodes'] == 11

    with page.expect_download() as download_info:
        page.get_by_role('button', name='Export progress backup').click()
    download = download_info.value
    backup = json.loads(Path(download.path()).read_text())
    assert backup == saved(page)
    before = saved(page)
    page.locator('input[type=file]').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"version":99}'})
    expect(page.get_by_role('status')).to_contain_text('not supported')
    assert saved(page) == before
    backup['progress']['1']['anime'] = 4
    page.locator('input[type=file]').set_input_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
    expect(page.get_by_role('dialog')).to_be_visible()
    assert saved(page)['progress']['1']['anime'] == 9
    page.get_by_role('dialog').get_by_role('button', name='Import backup', exact=True).click()
    assert saved(page)['progress']['1']['anime'] == 4
    page.reload(wait_until='networkidle')
    assert saved(page)['progress']['1']['anime'] == 4
    assert not errors, errors
    print('PASS desktop: progress, undo, notes, favorites, filters/search, adaptation, persistence, date catch-up, pause/resume, export/import')

    mobile_context = browser.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)
    mobile = mobile_context.new_page()
    mobile.goto(URL, wait_until='networkidle')
    mobile.screenshot(path=str(ROOT/'artifacts/mobile-top.png'), animations='disabled')
    assert mobile.evaluate('document.body.scrollWidth') == 390
    mobile.get_by_role('button', name='Open navigation').click()
    mobile.get_by_role('button', name='Adaptation', exact=True).click()
    expect(mobile.locator('h1')).to_contain_text('From page to screen')
    assert mobile.evaluate('document.body.scrollWidth') == 390
    mobile.get_by_role('button', name='Open navigation').click()
    mobile.get_by_role('button', name='Release schedule', exact=True).click()
    expect(mobile.get_by_role('dialog')).to_be_visible()
    assert mobile.get_by_role('dialog').evaluate('(el) => el.scrollWidth <= el.clientWidth + 1')
    mobile.get_by_role('dialog').get_by_role('button', name='Close dialog').click()
    expect(mobile.get_by_role('button', name='Close navigation', exact=True)).to_have_count(0)
    print('PASS mobile: layout fits 390px, menu, navigation, schedule form')

    # Invalid stored data must not be silently overwritten.
    broken = browser.new_page()
    broken.add_init_script("localStorage.setItem('jojo-journey-v1', '{broken')")
    broken.goto(URL, wait_until='networkidle')
    expect(broken.get_by_role('alert')).to_contain_text('original save is preserved')
    assert broken.evaluate("localStorage.getItem('jojo-journey-v1')") == '{broken'
    print('PASS corrupted storage: visible recovery message and original data preserved')
    browser.close()
