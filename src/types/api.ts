export interface DataResponse<T> { data: T }

export interface CurrentUser {
  public_id: string
  phone: string
  nickname: string
  avatar_url: string | null
}

export interface AuthSession {
  access: string
  refresh: string
  user: CurrentUser
}

export interface ProviderTrendItem {
  date: string
  label: string
  service_hours: number
}

export interface ProviderUpcomingOrder {
  public_id: string
  order_no: string
  starts_at: string
  ends_at: string
  service_name: string
  customer_name: string
  customer_gender_label: string
  meeting_location_name: string
  status: string
}

export interface ProviderWorkbench {
  nickname: string
  avatar_url: string | null
  is_accepting_orders: boolean
  is_online: boolean
  session_id: string | null
  admin_order_restricted: boolean
  admin_restriction_reason: string
  service_city_code: string
  service_city_name: string
  max_service_radius_km: number
  location_updated_at: string | null
  location_accuracy_m: string | number | null
  location_expires_at: string | null
  online_timeout_minutes: number
  recommended_report_interval_seconds: number
  today_order_count: number
  pending_acceptance_order_count: number
  month_income_amount: number
  month_order_count: number
  month_service_hours: number
  last_7_days_service_trend: ProviderTrendItem[]
  service_count: number
  upcoming_order: ProviderUpcomingOrder | null
}

export interface ProviderIncomeItem {
  settlement_no: string
  order_no: string
  service_name: string
  status: 'risk_frozen' | 'dispute_frozen' | 'settled' | 'cancelled'
  status_label: string
  service_income_amount: number
  transport_income_amount: number
  other_income_amount: number
  settlement_amount: number
  freeze_until: string
  settled_at: string | null
  created_at: string
}

export interface ProviderIncomeData {
  summary: {
    month_income_amount: number
    pending_amount: number
    settled_amount: number
    month_order_count: number
  }
  items: ProviderIncomeItem[]
}

export interface ProviderOnlineSession {
  is_accepting_orders: boolean
  is_online: boolean
  session_id: string | null
  location_updated_at: string | null
  location_accuracy_m: string | number | null
  location_expires_at: string | null
  online_timeout_minutes: number
  recommended_report_interval_seconds: number
}

export interface ProviderLocationPayload {
  longitude: number
  latitude: number
  accuracy_m: number
  located_at?: string
  speed_mps?: number
}

export interface ServiceCategory { id: number; name: string; slug: string }

export interface ProviderManagedService {
  id: number
  category_id: number
  category: string
  category_slug: string
  billing_type: 'hourly' | 'per_session'
  price_amount: number
  estimated_duration_minutes: number | null
  description: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProviderSchedulePeriod {
  id: string | null
  source: 'weekly' | 'date' | 'order'
  starts_at: string
  ends_at: string
  status: 'available' | 'booked'
}

export interface ProviderScheduleDay {
  date: string
  is_closed: boolean
  periods: ProviderSchedulePeriod[]
}

export interface ProviderManagedOrder {
  public_id: string
  order_no: string
  status: string
  status_label: string
  customer_name: string
  provider_public_id: string
  provider_name: string
  provider_avatar_url: string | null
  service_name: string
  billing_type_snapshot: 'hourly' | 'per_session'
  unit_price_amount: number
  starts_at: string
  ends_at: string
  duration_minutes: number
  meeting_location_name: string
  meeting_address: string
  contact_name: string
  contact_gender: 'mr' | 'ms' | ''
  contact_gender_label: string
  contact_phone_masked: string
  contact_phone_display: string
  note: string
  service_fee_amount: number
  transport_fee_amount: number
  other_fee_amount: number
  discount_amount: number
  payable_amount: number
  payment_expires_at: string
  paid_at: string | null
  accepted_at: string | null
  provider_rejected_at: string | null
  provider_rejection_reason: string
  departed_at: string | null
  arrival_photo_url: string | null
  arrival_photo_uploaded_at: string | null
  service_started_at: string | null
  completion_submitted_at: string | null
  confirmation_expires_at: string | null
  customer_confirmed_at: string | null
  auto_confirmed_at: string | null
  created_at: string
  acceptance_expires_at: string | null
  meeting_longitude: string | number | null
  meeting_latitude: string | number | null
}
