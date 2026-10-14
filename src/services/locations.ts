import type { DataResponse } from '@/types/api'

import { request } from './http'
import type { ServiceCity } from '@/utils/serviceCities'

export async function getServiceCities(): Promise<ServiceCity[]> {
  const response = await request<DataResponse<{ items: ServiceCity[] }>>('/locations/cities/', { skipAuth: true })
  return response.data.items
}

export interface ReverseGeocodedLocation {
  name: string
  address: string
  city_name: string
  city_code: string
  district_name: string
  longitude: number
  latitude: number
}

export function reverseGeocodeLocation(longitude: number, latitude: number) {
  return request<DataResponse<ReverseGeocodedLocation>>('/locations/reverse-geocode/', {
    query: { longitude, latitude },
  })
}
