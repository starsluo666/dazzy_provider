export interface DataResponse<T> { data: T }

export type ProviderIdentityStatus = 'unverified' | 'pending' | 'verified' | 'rejected'

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

export interface AccountSecurity {
  provider_credit_score: number | null
  phone_masked: string
  password_set: boolean
  account_status: 'active' | 'restricted' | 'suspended' | 'closed'
  account_status_label: string
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
  rating: string
  credit_score: number
  nickname: string
  avatar_url: string | null
  is_accepting_orders: boolean
  is_online: boolean
  session_id: string | null
  admin_order_restricted: boolean
  admin_restriction_reason: string
  identity_status: ProviderIdentityStatus
  identity_status_label: string
  onboarding_status: 'incomplete' | 'pending_review' | 'approved' | 'rejected'
  onboarding_status_label: string
  onboarding_rejection_reason: string
  profile_review_status: 'not_submitted' | 'pending' | 'approved' | 'rejected'
  pending_service_revision_count: number
  is_profile_complete: boolean
  can_accept_orders: boolean
  onboarding_blockers: string[]
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

export interface ProviderIdentity {
  identity_status: ProviderIdentityStatus
  identity_status_label: string
  identity_real_name: string
  identity_number_masked: string
  identity_front_photo_id: string | null
  identity_back_photo_id: string | null
  identity_face_photo_id: string | null
  identity_front_photo_url: string | null
  identity_back_photo_url: string | null
  identity_face_photo_url: string | null
  identity_submitted_at: string | null
  identity_reviewed_at: string | null
  identity_rejection_reason: string
}

export interface ProviderMedia { id: string; type: 'image' | 'video'; url: string }

export interface ProviderProfileData {
  media: ProviderMedia[]
  display_name: string
  bio: string
  lifestyle_photo_id: string | null
  lifestyle_photo_url: string | null
  service_city_code: string
  service_city_name: string
  max_service_radius_km: number
  is_profile_complete: boolean
  review_status: 'not_submitted' | 'pending' | 'approved' | 'rejected'
  review_rejection_reason: string
  updated_at: string
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

export interface ServiceCategory {
  id: number
  name: string
  slug: string
  hourly_min_price_amount: number
  hourly_max_price_amount: number
  per_session_min_price_amount: number
  per_session_max_price_amount: number
}

export interface ProviderManagedService {
  id: number | null
  revision_id: number | null
  category_id: number
  category: string
  category_slug: string
  billing_type: 'hourly' | 'per_session'
  price_amount: number
  estimated_duration_minutes: number | null
  description: string
  is_active: boolean
  review_status: 'pending' | 'approved' | 'rejected'
  review_action: '' | 'create' | 'update' | 'reactivate'
  review_rejection_reason: string
  hourly_min_price_amount: number
  hourly_max_price_amount: number
  per_session_min_price_amount: number
  per_session_max_price_amount: number
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

export type NotificationCategory = 'support' | 'order' | 'activity' | 'system'

export interface NotificationSummary {
  total: number
  unread: number
  category_unread: Record<NotificationCategory, number>
}

export interface UserNotification {
  public_id: string
  category: NotificationCategory
  category_label: string
  event_type: string
  event_type_label: string
  title: string
  content: string
  target_type: string
  target_id: string
  target_title: string
  action_text: string
  action_url: string
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface NotificationListResponse {
  data: {
    items: UserNotification[]
    pagination: { page: number; page_size: number; total: number }
    summary: NotificationSummary
  }
}
