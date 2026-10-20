"""Full UI regression audit. Run with the Vite server on port 5174.
Uses isolated browser profiles and a fixed clock; never changes real user saves.
"""
import copy
import json
import os
import unittest
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = os.environ.get('JOJO_TEST_URL', 'http://127.0.0.1:5174')
KEY = 'jojo-journey-v1'
TITLES = ['Phantom Blood', 'Battle Tendency', 'Stardust Crusaders', 'Diamond Is Unbreakable', 'Golden Wind', 'Stone Ocean', 'Steel Ball Run', 'JoJolion', 'The JOJOLands']
BASE = {'version':1, 'progress':{}, 'releases':{}, 'schedules':{
 'sbr':{'enabled':True,'cadence':'weekly','day':5,'nextRelease':'2026-10-23'},
 'jojolands':{'enabled':True,'cadence':'monthly','day':19,'nextRelease':'2026-11-19'}}}

class UIAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        expect.set_options(timeout=2500)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1440,'height':1000},timezone_id='America/Denver',reduced_motion='reduce')
        self.page = self.context.new_page()
        self.page.set_default_timeout(3500)
        self.errors = []
        self.page.on('pageerror', lambda e:self.errors.append(str(e)))
        self.page.clock.install(time=datetime(2026,10,22,18,tzinfo=timezone.utc))
        self.page.goto(URL, wait_until='networkidle')

    def tearDown(self):
        try:
            self.assertEqual(self.errors, [], 'Unexpected JavaScript exceptions')
        finally:
            self.context.close()

    def saved(self):
        return self.page.evaluate('(key)=>JSON.parse(localStorage.getItem(key))', KEY)

    def seed(self, state):
        self.page.evaluate('([key,state])=>localStorage.setItem(key,JSON.stringify(state))', [KEY,state])
        self.page.reload(wait_until='networkidle')

    def button(self, name):
        return self.page.get_by_role('button',name=name,exact=True)

    def dialog(self):
        return self.page.get_by_role('dialog')

    def close(self):
        self.dialog().get_by_role('button',name='Close dialog',exact=True).click()
        expect(self.dialog()).to_have_count(0)

    def card(self, title):
        return self.page.locator('.part-card').filter(has=self.page.get_by_role('heading', name=title, exact=True))

    def format(self, medium):
        self.page.locator('.medium-toggle').get_by_role('button', name=medium,exact=True).click()

    def test_navigation_hero_and_help(self):
        pages = {'My library':'A collection of adventures','Story timeline':'Through the generations','Adaptation':'From page to screen','Favorites 0':'The parts you love','Overview':'Your bizarre adventure'}
        for nav, title in pages.items():
            self.button(nav).click()
            expect(self.page.locator('h1')).to_contain_text(title)
        self.button('Start your journey').click()
        expect(self.dialog()).to_have_attribute('aria-label','Track Phantom Blood')
        self.dialog().get_by_role('button',name='Increase anime progress').click()
        self.dialog().get_by_role('button',name='Save progress',exact=True).click()
        self.button('Continue your journey').click()
        expect(self.dialog().get_by_label('Episodes watched',exact=True)).to_have_value('1')
        self.close()
        self.page.locator('.adaptation-stat').click()
        expect(self.page.locator('h1')).to_contain_text('From page to screen')
        self.button('JoJo Journey home').click()
        expect(self.page.locator('h1')).to_contain_text('Your bizarre adventure')
        for opener in ['How it works','About your local profile']:
            self.button(opener).click()
            expect(self.dialog()).to_have_attribute('aria-label','About your journey')
            self.dialog().get_by_role('button',name='Back to the adventure',exact=True).click()
            expect(self.dialog()).to_have_count(0)

    def test_every_part_opening_control(self):
        for title in TITLES:
            for selector in [f'Open {title}',title,f'Edit {title} progress']:
                self.card(title).get_by_role('button',name=selector,exact=True).click()
                expect(self.dialog()).to_have_attribute('aria-label',f'Track {title}')
                self.close()
        for i,title in enumerate(TITLES):
            self.page.locator('.timeline-stop').nth(i).click()
            expect(self.dialog()).to_have_attribute('aria-label',f'Track {title}')
            self.close()
        self.button('Adaptation').click()
        for i,title in enumerate(TITLES):
            self.page.locator('.adaptation-part').nth(i).click()
            expect(self.dialog()).to_have_attribute('aria-label',f'Track {title}')
            self.close()

    def test_progress_steppers_bounds_notes_and_completion(self):
        self.button('Start your journey').click()
        d=self.dialog()
        for medium,label,total in [('anime','Episodes watched',9),('manga','Chapters read',44)]:
            expect(d.get_by_role('button',name=f'Decrease {medium} progress')).to_be_disabled()
            d.get_by_role('button',name=f'Increase {medium} progress').click()
            expect(d.get_by_label(label,exact=True)).to_have_value('1')
            d.get_by_role('button',name=f'Decrease {medium} progress').click()
            d.get_by_label(label,exact=True).fill(str(total+1))
            d.get_by_role('button',name='Save progress',exact=True).click()
            expect(d).to_be_visible()
            self.assertFalse(d.get_by_label(label,exact=True).evaluate('(el)=>el.checkValidity()'))
            d.get_by_label(label,exact=True).fill(str(total))
            expect(d.get_by_role('button',name=f'Increase {medium} progress')).to_be_disabled()
        d.get_by_label('Your notes',exact=False).fill('My test note\n<script>literal, not executable</script>')
        d.get_by_role('button',name='Favorite',exact=True).click()
        d.get_by_role('button',name='Favorited',exact=True).click()
        d.get_by_role('button',name='Save progress',exact=True).click()
        self.assertEqual(self.saved()['progress']['1']['favorite'],False)
        expect(self.card('Phantom Blood').locator('.status')).to_have_text('Completed')
        self.card('Phantom Blood').get_by_role('button',name='Edit progress',exact=True).click()
        expect(self.dialog().get_by_label('Your notes',exact=False)).to_have_value('My test note\n<script>literal, not executable</script>')
        self.dialog().get_by_label('Chapters read',exact=True).fill('1')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.saved()['progress']['1']['manga'],44)
        self.card('Steel Ball Run').get_by_role('button',name='Open Steel Ball Run',exact=True).click()
        self.dialog().get_by_role('button',name='Mark caught up',exact=True).click()
        expect(self.dialog().get_by_label('Episodes watched',exact=True)).to_have_value('6')
        self.dialog().get_by_role('button',name='Mark complete',exact=True).click()
        expect(self.dialog().get_by_label('Chapters read',exact=True)).to_have_value('95')
        self.close()

    def test_format_switch_and_quick_logging_respect_selected_medium(self):
        self.format('Manga')
        expect(self.page.locator('.card-progress .progress-label').first).to_contain_text('Manga')
        self.card('Phantom Blood').get_by_role('button',name='Log chapter',exact=True).click()
        self.assertEqual(self.saved()['progress']['1']['manga'],1)
        self.format('Anime')
        self.card('Phantom Blood').get_by_role('button',name='Log episode',exact=True).click()
        self.assertEqual(self.saved()['progress']['1']['anime'],1)
        # Anime-only mode must never offer to log a manga chapter.
        expect(self.card('JoJolion').get_by_role('button',name='Log chapter',exact=True)).to_have_count(0)
        self.card('JoJolion').locator('.quick-add').click()
        expect(self.dialog()).to_be_visible()
        self.close()
        self.format('All formats')
        expect(self.card('JoJolion').get_by_role('button',name='Log chapter',exact=True)).to_be_visible()

    def test_filters_favorites_and_empty_states(self):
        self.button('Favorites 0').click()
        expect(self.page.locator('.empty-state')).to_contain_text('Keep your favorites close')
        self.button('Explore all parts').click()
        expect(self.page.locator('.part-card')).to_have_count(9)
        self.card('Phantom Blood').get_by_role('button',name='Favorite Phantom Blood',exact=True).click()
        self.button('Favorites 1').click()
        expect(self.page.locator('.part-card')).to_have_count(1)
        self.card('Phantom Blood').get_by_role('button',name='Unfavorite Phantom Blood',exact=True).click()
        expect(self.page.locator('.empty-state')).to_be_visible()
        self.button('My library').click()
        self.card('Battle Tendency').get_by_role('button',name='Log episode',exact=True).click()
        self.button('In progress').click()
        expect(self.page.locator('.part-card')).to_have_count(1)
        expect(self.page.locator('.part-card h3')).to_have_text('Battle Tendency')
        self.button('Not started').click()
        expect(self.page.locator('.part-card')).to_have_count(8)
        self.button('Completed').click()
        expect(self.page.locator('.empty-state')).to_be_visible()
        self.button('Explore all parts').click()
        expect(self.page.locator('.part-card')).to_have_count(9)

    def test_search_keyboard_and_recovery(self):
        self.page.keyboard.press('Control+k')
        expect(self.page.get_by_role('textbox',name='Search parts')).to_be_focused()
        for query,title in [('jolyne','Stone Ocean'),('Egypt','Stardust Crusaders'),('phantom','Phantom Blood')]:
            self.page.get_by_role('textbox',name='Search parts').fill(query)
            expect(self.page.locator('.part-card')).to_have_count(1)
            expect(self.page.locator('.part-card h3')).to_have_text(title)
        self.page.get_by_role('textbox',name='Search parts').fill('not a real part')
        expect(self.page.locator('.empty-state')).to_contain_text('No adventure by that name')
        self.button('Clear search').click()
        expect(self.page.locator('.part-card')).to_have_count(9)
        self.button('Adaptation').click()
        self.page.get_by_role('textbox',name='Search parts').fill('Golden Wind')
        expect(self.page.locator('h1')).to_contain_text('A collection of adventures')
        expect(self.page.locator('.part-card')).to_have_count(1)

    def test_sort_control(self):
        self.card('Battle Tendency').get_by_role('button',name='Log episode',exact=True).click()
        self.page.get_by_role('combobox',name='Sort parts').select_option('most')
        expect(self.page.locator('.part-card h3').first).to_have_text('Battle Tendency')
        self.page.get_by_role('combobox',name='Sort parts').select_option('least')
        expect(self.page.locator('.part-card h3').last).to_have_text('Battle Tendency')
        self.page.get_by_role('combobox',name='Sort parts').select_option('publication')
        expect(self.page.locator('.part-card h3').first).to_have_text('Phantom Blood')

    def test_catalog_inputs_validation_cancel_clamp_and_undo(self):
        s=copy.deepcopy(BASE);s['progress']['1']={'anime':9,'manga':44,'favorite':False,'notes':'Keep me'}
        self.seed(s)
        self.button('Release catalog').click()
        d=self.dialog()
        # Every episode/chapter/coverage input can be edited and saved.
        for title in TITLES:
            for field,value in [('episodes','2'),('chapters','10'),('adapted','5')]:
                d.get_by_label(f'{title} {field}',exact=True).fill(value)
        d.get_by_label('Phantom Blood adapted',exact=True).fill('11')
        d.get_by_role('button',name='Update catalog',exact=True).click()
        expect(d.get_by_role('alert')).to_contain_text('adapted chapters')
        d.get_by_label('Phantom Blood adapted',exact=True).fill('5')
        d.get_by_role('button',name='Update catalog',exact=True).click()
        state=self.saved()
        for i in range(1,10):self.assertEqual(state['releases'][str(i)],{'episodes':2,'chapters':10,'adapted':5})
        self.assertEqual(state['progress']['1']['anime'],2)
        self.assertEqual(state['progress']['1']['manga'],10)
        self.assertEqual(state['progress']['1']['notes'],'Keep me')
        self.button('Undo').click()
        self.assertEqual(self.saved(),s)
        self.button('Release catalog').click()
        self.dialog().get_by_label('Phantom Blood episodes',exact=True).fill('0')
        self.dialog().get_by_role('button',name='Update catalog',exact=True).click()
        expect(self.dialog().get_by_role('alert')).to_be_visible()
        self.dialog().get_by_role('button',name='Cancel',exact=True).click()
        self.assertEqual(self.saved(),s)
        # Exercise the real popup action using controlled destinations, not live external services.
        self.button('Release catalog').click()
        for a in self.dialog().get_by_role('link').all():
            destination=a.get_attribute('href')
            self.assertTrue(destination.startswith('https://'))
            self.assertEqual(a.get_attribute('target'),'_blank')
            self.context.route(destination,lambda route:route.fulfill(status=200,content_type='text/html',body='<title>External reference</title>'))
            with self.page.expect_popup() as popup:
                a.click()
            popup.value.wait_for_load_state()
            self.assertEqual(popup.value.url,destination)
            popup.value.close()
        self.close()

    def test_uncataloged_progress_links_to_catalog(self):
        self.card('JoJolion').get_by_role('button',name='Open JoJolion',exact=True).click()
        self.dialog().get_by_role('button',name='Set release count',exact=True).click()
        expect(self.dialog()).to_have_attribute('aria-label','Release catalog')
        self.dialog().get_by_label('JoJolion episodes',exact=True).fill('1')
        self.dialog().get_by_role('button',name='Update catalog',exact=True).click()
        self.format('Anime')
        expect(self.card('JoJolion').get_by_role('button',name='Log episode',exact=True)).to_be_visible()

    def test_adaptation_rounding_does_not_claim_completion(self):
        s=copy.deepcopy(BASE);s['releases']['7']={'episodes':6,'chapters':1000,'adapted':999}
        self.seed(s)
        self.button('Adaptation').click()
        row=self.page.locator('.adaptation-row').nth(6)
        expect(row.locator('.coverage-status')).not_to_contain_text('Fully adapted')
        expect(self.page.locator('.catalog-note')).not_to_contain_text('its adapted chapter count is not yet set')
        for name in ['Update release catalog','Edit catalog']:
            self.button(name).click()
            expect(self.dialog()).to_have_attribute('aria-label','Release catalog')
            self.close()

    def test_schedule_entry_points_and_cancel(self):
        for opener in ['Manage schedule','Manage Steel Ball Run release schedule','Manage The JOJOLands release schedule','Release schedule']:
            self.button(opener).click()
            expect(self.dialog()).to_have_attribute('aria-label','Automatic release schedule')
            self.dialog().get_by_label('Current Steel Ball Run episode',exact=True).fill('99')
            self.dialog().get_by_role('button',name='Cancel',exact=True).click()
            expect(self.page.locator('.release-card.sbr')).to_contain_text('Episode 7')

    def test_schedule_fields_dates_toggles_and_counts(self):
        self.button('Release schedule').click(); d=self.dialog()
        d.get_by_label('Steel Ball Run next release',exact=True).fill('2026-10-24')
        d.get_by_role('button',name='Save schedule',exact=True).click()
        expect(d.get_by_role('alert')).to_contain_text('Friday')
        d.get_by_label('Steel Ball Run next release',exact=True).fill('2026-10-30')
        d.get_by_label('Current Steel Ball Run episode',exact=True).fill('8')
        d.get_by_label('Current JOJOLands chapter',exact=True).fill('44')
        d.get_by_label('JOJOLands monthly release day',exact=True).fill('31')
        expect(d.get_by_label('JOJOLands next release',exact=True)).to_have_value('2026-10-31')
        d.get_by_label('JOJOLands next release',exact=True).fill('2026-11-30')
        for name in ['Steel Ball Run automatic updates','JOJOLands automatic updates']:
            d.get_by_role('checkbox',name=name).uncheck()
        d.get_by_role('button',name='Save schedule',exact=True).click()
        expect(self.page.locator('.release-card.sbr')).to_contain_text('Updates paused')
        expect(self.page.locator('.release-card.jojolands')).to_contain_text('Updates paused')
        self.assertEqual(self.saved()['releases']['7']['episodes'],8)
        self.assertEqual(self.saved()['releases']['9']['chapters'],44)
        self.page.reload(wait_until='networkidle')
        self.button('Release schedule').click()
        expect(self.dialog().get_by_label('JOJOLands monthly release day',exact=True)).to_have_value('31')
        self.close()
        self.page.clock.set_system_time(datetime(2027,1,1,18,tzinfo=timezone.utc))
        self.page.evaluate("window.dispatchEvent(new Event('focus'))")
        self.assertEqual(self.saved()['releases']['7']['episodes'],8)
        self.assertEqual(self.saved()['releases']['9']['chapters'],44)

    def test_automatic_update_while_page_stays_open(self):
        self.page.clock.set_system_time(datetime(2026,10,23,5,59,30,tzinfo=timezone.utc))
        self.page.clock.fast_forward(61000)
        expect(self.page.locator('.release-card.sbr')).to_contain_text('Episode 8')
        self.assertEqual(self.saved()['releases']['7']['episodes'],7)
        self.assertEqual(self.saved()['progress'],{})
        self.page.clock.fast_forward(61000)
        self.assertEqual(self.saved()['releases']['7']['episodes'],7)

    def test_backup_picker_invalid_files_cancel_restore_and_undo(self):
        with self.page.expect_file_chooser() as chooser:
            self.button('Import progress').click()
        chooser.value.set_files({'name':'invalid.json','mimeType':'application/json','buffer':b'not json'})
        expect(self.page.get_by_role('status')).to_contain_text('not valid JSON')
        self.button('Dismiss notification').click()
        expect(self.page.get_by_role('status')).to_have_count(0)
        self.page.locator('input[type=file]').set_input_files({'name':'big.json','mimeType':'application/json','buffer':b' '*1000001})
        expect(self.page.get_by_role('status')).to_contain_text('smaller than 1 MB')
        backup=copy.deepcopy(BASE);backup['progress']['3']={'anime':7,'manga':2,'favorite':True,'notes':'Backup note'}
        payload={'name':'backup.json','mimeType':'application/json','buffer':json.dumps(backup).encode()}
        self.page.locator('input[type=file]').set_input_files(payload)
        self.close()
        self.assertIsNone(self.saved())
        self.page.locator('input[type=file]').set_input_files(payload)
        with self.page.expect_download() as download:
            self.dialog().get_by_role('button',name='Export current',exact=True).click()
        current=json.loads(Path(download.value.path()).read_text())
        self.assertEqual(current['progress'],{})
        self.dialog().get_by_role('button',name='Import backup',exact=True).click()
        self.assertEqual(self.saved(),backup)
        self.button('Undo').click()
        self.assertEqual(self.saved()['progress'],{})
        with self.page.expect_download() as download:
            self.button('Export progress backup').click()
        self.assertEqual(json.loads(Path(download.value.path()).read_text()),self.saved())

    def test_dialog_keyboard_focus_and_backdrop(self):
        opener=self.button('Start your journey')
        opener.click()
        expect(self.dialog().get_by_role('button',name='Close dialog')).to_be_focused()
        for _ in range(18):
            self.page.keyboard.press('Tab')
            self.assertTrue(self.page.evaluate('!!document.activeElement.closest("dialog")'))
        self.page.keyboard.press('Escape')
        expect(self.dialog()).to_have_count(0)
        expect(opener).to_be_focused()
        opener.click()
        self.page.mouse.click(10,10)
        expect(self.dialog()).to_have_count(0)
        expect(opener).to_be_focused()
        self.assertNotEqual(self.page.evaluate('document.body.style.overflow'),'hidden')

    def test_mobile_navigation_backups_and_keyboard(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.wait_for_timeout(50)
        # All primary actions must remain accessible at phone width.
        expect(self.button('Import progress')).to_be_visible()
        expect(self.button('Export progress backup')).to_be_visible()
        self.button('Open navigation').click()
        self.page.keyboard.press('Escape')
        expect(self.button('Close navigation')).to_have_count(0)
        expect(self.button('Open navigation')).to_be_focused()
        self.button('Open navigation').click()
        for _ in range(17):
            self.page.keyboard.press('Tab')
            self.assertTrue(self.page.evaluate('!!document.activeElement.closest(".sidebar")'))
        self.button('Close navigation').click()
        expect(self.button('Close navigation')).to_have_count(0)
        for nav,heading in [('My library','A collection'),('Story timeline','Through'),('Adaptation','From page'),('Favorites 0','The parts'),('Overview','Your bizarre')]:
            self.button('Open navigation').click()
            self.button(nav).click()
            expect(self.page.locator('h1')).to_contain_text(heading)
            expect(self.button('Close navigation')).to_have_count(0)
        with self.page.expect_download() as download:
            self.button('Export progress backup').click()
        self.assertEqual(json.loads(Path(download.value.path()).read_text())['progress'],{})
        with self.page.expect_file_chooser() as chooser:
            self.button('Import progress').click()
        chooser.value.set_files({'name':'backup.json','mimeType':'application/json','buffer':json.dumps(BASE).encode()})
        expect(self.dialog()).to_be_visible()
        self.close()

    def test_mobile_hidden_navigation_is_not_keyboard_focusable(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.wait_for_timeout(50)
        self.page.locator('.sidebar button').first.focus()
        self.assertFalse(self.page.evaluate('!!document.activeElement.closest(".sidebar")'))
        self.button('Open navigation').focus()
        for _ in range(45):
            self.page.keyboard.press('Tab')
            self.assertFalse(self.page.evaluate('!!document.activeElement.closest(".sidebar")'))

    def test_responsive_forms_fit_at_small_width(self):
        for width in [320,390,768,1024]:
            self.page.set_viewport_size({'width':width,'height':844})
            self.page.wait_for_timeout(50)
            self.assertEqual(self.page.evaluate('document.body.scrollWidth'),width)
            for nav in ['Release schedule','Release catalog','How it works']:
                if width<=760:self.button('Open navigation').click()
                self.button(nav).click()
                self.assertTrue(self.dialog().evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'))
                self.close()
            self.button('Start your journey').click()
            self.assertTrue(self.dialog().evaluate('(el)=>el.scrollWidth<=el.clientWidth+1'))
            self.close()

    def test_completed_journey_totals_and_hero_fallback(self):
        s=copy.deepcopy(BASE)
        for i,(anime,manga) in enumerate(zip([9,17,48,39,39,38,6,0,0],[44,69,152,174,155,158,95,110,41]),1):
            s['progress'][str(i)]={'anime':anime,'manga':manga,'favorite':False,'notes':''}
        self.seed(s)
        expect(self.page.get_by_role('progressbar',name='Parts completed',exact=True)).to_have_attribute('aria-valuenow','100')
        expect(self.page.get_by_role('progressbar',name='Total episodes watched',exact=True)).to_have_attribute('aria-valuenow','100')
        expect(self.page.get_by_role('progressbar',name='Total chapters read',exact=True)).to_have_attribute('aria-valuenow','100')
        expect(self.page.get_by_role('progressbar',name='Overall personal journey',exact=True)).to_have_attribute('aria-valuenow','100')
        self.button('Continue your journey').click()
        expect(self.page.locator('h1')).to_contain_text('A collection of adventures')
        self.assertEqual(self.dialog().count(),0)

    def test_empty_catalog_stays_usable(self):
        s=copy.deepcopy(BASE)
        for i in range(1,10):s['releases'][str(i)]={'episodes':0,'chapters':0,'adapted':0}
        for schedule in s['schedules'].values():schedule['enabled']=False
        self.seed(s)
        self.assertNotIn('NaN',self.page.locator('main').inner_text())
        expect(self.page.get_by_role('progressbar',name='Overall personal journey',exact=True)).to_have_attribute('aria-valuenow','0')
        self.button('Start your journey').click()
        expect(self.page.locator('h1')).to_contain_text('A collection of adventures')
        self.card('Phantom Blood').get_by_role('button',name='Edit progress',exact=True).click()
        self.dialog().get_by_role('button',name='Set release count',exact=True).first.click()
        expect(self.dialog()).to_have_attribute('aria-label','Release catalog')
        self.close()

    def test_mobile_edit_and_save_progress(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.wait_for_timeout(50)
        self.button('Start your journey').click()
        d=self.dialog()
        d.get_by_role('button',name='Increase anime progress',exact=True).click()
        d.get_by_role('button',name='Increase manga progress',exact=True).click()
        d.get_by_label('Your notes',exact=False).fill('Saved from phone layout')
        d.get_by_role('button',name='Favorite',exact=True).click()
        d.get_by_role('button',name='Save progress',exact=True).click()
        self.assertEqual(self.saved()['progress']['1'],{'anime':1,'manga':1,'favorite':True,'notes':'Saved from phone layout'})
        self.page.reload(wait_until='networkidle')
        self.card('Phantom Blood').get_by_role('button',name='Edit Phantom Blood progress',exact=True).click()
        expect(self.dialog().get_by_label('Your notes',exact=False)).to_have_value('Saved from phone layout')
        self.close()

    def test_corrupt_storage_recovery_via_import(self):
        self.page.evaluate('(key)=>localStorage.setItem(key,"{corrupt")',KEY)
        self.page.reload(wait_until='networkidle')
        expect(self.page.get_by_role('alert')).to_contain_text('original save is preserved')
        self.card('Phantom Blood').get_by_role('button',name='Log episode',exact=True).click()
        self.assertEqual(self.page.evaluate('(key)=>localStorage.getItem(key)',KEY),'{corrupt')
        with self.page.expect_download() as download:
            self.page.get_by_role('alert').get_by_role('button',name='Export backup',exact=True).click()
        recovery=Path(download.value.path()).read_bytes()
        self.assertEqual(json.loads(recovery)['progress']['1']['anime'],1)
        self.page.locator('input[type=file]').set_input_files({'name':'recovered.json','mimeType':'application/json','buffer':recovery})
        self.dialog().get_by_role('button',name='Import backup',exact=True).click()
        expect(self.page.get_by_role('alert')).to_have_count(0)
        self.card('Phantom Blood').get_by_role('button',name='Log episode',exact=True).click()
        self.assertEqual(self.saved()['progress']['1']['anime'],2)
        self.page.reload(wait_until='networkidle')
        self.assertEqual(self.saved()['progress']['1']['anime'],2)

    def test_storage_failure_still_allows_backup(self):
        self.page.evaluate("() => { Storage.prototype.setItem = function(){ throw new DOMException('Full', 'QuotaExceededError') }; }")
        self.card('Phantom Blood').get_by_role('button',name='Log episode',exact=True).click()
        expect(self.page.get_by_role('alert')).to_contain_text('could not save')
        with self.page.expect_download() as download:
            self.page.get_by_role('alert').get_by_role('button',name='Export backup',exact=True).click()
        data=json.loads(Path(download.value.path()).read_text())
        self.assertEqual(data['progress']['1']['anime'],1)
        self.assertIsNone(self.saved())

if __name__=='__main__':
    unittest.main(verbosity=2)
