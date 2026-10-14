export interface ServiceCity { city_code: string; city_name: string }

// Never silently move a provider out of a closed city. Require an explicit selection.
export function selectServiceCity(cities: ServiceCity[], previousCode = '') {
  const city = previousCode
    ? cities.find(item => item.city_code === previousCode)
    : cities.length === 1 ? cities[0] : undefined
  return { code: city?.city_code || '', name: city?.city_name || '', unavailable: Boolean(previousCode && !city) }
}
