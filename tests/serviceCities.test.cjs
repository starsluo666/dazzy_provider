const assert = require('node:assert/strict')
const { execute, read, selection } = require('./serviceCities.fixture.cjs')
const vue = require('vue')
const provider = require('../package.json').name === 'dazzy-provider'
const file = provider ? 'pages/provider-profile/index.vue' : 'pages/providers/apply.vue'
const source = read(file)
const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
const handan = { city_code: '130400', city_name: '邯郸市' }
const chengdu = { city_code: '510100', city_name: '成都市' }
function mount({ code = '', available = [handan], fail = false } = {}) {
  let values = available, failing = fail, writes = 0
  const messages = []
  const profile = { display_name: '测试达人', bio: '这是一段完整的测试达人介绍', lifestyle_photo_id: 'photo', lifestyle_photo_url: '/photo.jpg',
    media: [{ id: 'photo', url: '/photo.jpg', type: 'image', cropped: true }], service_city_code: code,
    service_city_name: '不得信任的旧名称', max_service_radius_km: 10, review_status: 'approved', status: 'draft',
    application_real_name: '测试达人', application_birth_date: '1996-01-01', invitation_code: '' }
  const getCities = async () => { if (failing) throw new Error('城市加载失败'); return values }
  const imports = { vue, '@dcloudio/uni-app': { onLoad() {}, onHide() {}, onUnload() {} },
    '@/services/providers': {
      getProviderProfile: async () => ({ data: profile }), getProviderApplication: async () => ({ data: profile }),
      saveProviderProfile: async () => { writes++; return { data: profile } },
      saveProviderApplication: async () => { writes++; return { data: profile } },
      submitProviderApplication: async () => { writes++; return { data: profile } },
    },
    '@/services/locations': { getServiceCities: getCities },
    '@/services/discoveryContext': { getDiscoveryCities: getCities },
    '@/utils/serviceCities': selection,
    '@/utils/formatters': { getErrorMessage: e => e.message },
    '@/utils/navigation': {}, '@/services/session': { guardCurrentPage: () => true },
    '@/services/auth': { getCurrentUser: async () => ({ data: { gender: 'female' } }) },
  }
  const api = execute(script + '\nexports.api = { load, form, cities, cityIndex, cityUnavailable, chooseCity, error, ' +
    (provider ? 'save' : 'save: submit, agreed') + ' };', imports, { uni: { showToast: o => messages.push(o.title), createVideoContext: () => ({ pause() {} }) } }).api
  return { ...api, messages, setCities: items => { values = items }, fail: () => { failing = true }, writes: () => writes }
}
async function main() {
  assert.doesNotMatch(source, /name: '北京市'|name: '上海市'|service_city_code: '130400'/)
  assert.match(source, /cities.length === 1 && form.service_city_code/)
  let page = mount()
  await page.load()
  assert.equal(page.form.service_city_code, '130400')
  assert.equal(page.form.service_city_name, '邯郸市')
  page = mount({ available: [handan, chengdu] })
  await page.load()
  assert.equal(page.form.service_city_code, '')
  page.chooseCity({ detail: { value: '0' } })
  assert.equal(page.form.service_city_code, '', 'placeholder never implicitly chooses a city')
  page.chooseCity({ detail: { value: '2' } })
  assert.equal(page.form.service_city_code, '510100')
  assert.equal(page.cityIndex.value, 1)
  page = mount({ code: '110100' })
  await page.load()
  assert.equal(page.form.service_city_code, '')
  assert.equal(page.cityUnavailable.value, true, 'closed historic city requires explicit reselection')
  page.chooseCity({ detail: { value: '0' } })
  assert.equal(page.form.service_city_code, '')
  page.chooseCity({ detail: { value: '1' } })
  assert.equal(page.form.service_city_name, '邯郸市')
  assert.equal(page.cityUnavailable.value, false)
  if (!provider) page.agreed.value = true
  page.setCities([chengdu])
  await page.save()
  assert.equal(page.writes(), 0, 'city closed mid-form must not create application/revision')
  assert.equal(page.form.service_city_code, '')
  assert.equal(page.cityUnavailable.value, true)
  page = mount({ code: '130400', fail: true })
  await page.load()
  await page.save()
  assert.equal(page.writes(), 0)
  assert.equal(page.cities.value.length, 0, 'failed city load must never fall back to preset cities')
  page = mount({ available: [] })
  await page.load()
  await page.save()
  assert.equal(page.writes(), 0)
  page = mount({ code: '130400' })
  await page.load()
  if (!provider) page.agreed.value = true
  await page.save()
  assert.equal(page.writes(), provider ? 1 : 2)
  console.log('PASS service city forms: config-only choices, single/multi, canonical names, legacy closed city, failed/empty load and mid-submit closure')
}
main().catch(e => { console.error(e); process.exitCode = 1 })
