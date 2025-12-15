/**
 * 택배사별 배송조회 URL 및 정보
 */

export interface DeliveryCompany {
  code: string
  name: string
  trackingUrl: (trackingNumber: string) => string
  phone?: string
}

export const DELIVERY_COMPANIES: DeliveryCompany[] = [
  {
    code: 'cj',
    name: 'CJ대한통운',
    trackingUrl: (no) => `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${no}`,
    phone: '1588-1255',
  },
  {
    code: 'hanjin',
    name: '한진택배',
    trackingUrl: (no) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mession=1&wblnumText2=${no}`,
    phone: '1588-0011',
  },
  {
    code: 'lotte',
    name: '롯데택배',
    trackingUrl: (no) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${no}`,
    phone: '1588-2121',
  },
  {
    code: 'post',
    name: '우체국택배',
    trackingUrl: (no) => `https://service.epost.go.kr/trace.RetrieveDomRi498.postal?sid1=${no}`,
    phone: '1588-1300',
  },
  {
    code: 'logen',
    name: '로젠택배',
    trackingUrl: (no) => `https://www.ilogen.com/web/personal/trace/${no}`,
    phone: '1588-9988',
  },
  {
    code: 'kdexp',
    name: '경동택배',
    trackingUrl: (no) => `https://kdexp.com/basicNew498.kd?barcode=${no}`,
    phone: '1899-5368',
  },
  {
    code: 'daesin',
    name: '대신택배',
    trackingUrl: (no) => `https://www.ds3211.co.kr/freight/internalFreightSearch.ht?billno=${no}`,
    phone: '043-222-4582',
  },
  {
    code: 'cupost',
    name: 'CU편의점택배',
    trackingUrl: (no) => `https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=${no}`,
    phone: '1566-1025',
  },
  {
    code: 'gspost',
    name: 'GS편의점택배',
    trackingUrl: (no) => `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${no}`,
    phone: '1577-1287',
  },
  {
    code: 'ems',
    name: 'EMS',
    trackingUrl: (no) => `https://service.epost.go.kr/trace.RetrieveEmsRi498.postal?POST_CODE=${no}`,
    phone: '1588-1300',
  },
]

/**
 * 택배사 코드로 택배사 정보 찾기
 */
export function getDeliveryCompany(code: string): DeliveryCompany | undefined {
  return DELIVERY_COMPANIES.find(c => c.code === code)
}

/**
 * 택배사 이름으로 택배사 정보 찾기
 */
export function getDeliveryCompanyByName(name: string): DeliveryCompany | undefined {
  return DELIVERY_COMPANIES.find(c => c.name === name)
}

/**
 * 배송조회 URL 생성
 */
export function getTrackingUrl(companyCode: string, trackingNumber: string): string | null {
  const company = getDeliveryCompany(companyCode)
  if (!company) return null
  return company.trackingUrl(trackingNumber)
}

/**
 * 택배사 이름으로 배송조회 URL 생성
 */
export function getTrackingUrlByName(companyName: string, trackingNumber: string): string | null {
  const company = getDeliveryCompanyByName(companyName)
  if (!company) return null
  return company.trackingUrl(trackingNumber)
}
