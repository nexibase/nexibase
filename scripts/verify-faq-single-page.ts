import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const base = process.argv[2]
const crud = process.argv.includes('crud')
const requireMenu = process.argv.includes('menu')
assert.ok(base && process.env.NEXTAUTH_SECRET)
async function fingerprint() {
  const result: Record<string, string> = {}
  for (const table of ['faq_categories','faqs','boards','posts','comments','reactions','contents','policies','menus','page_widgets','widget_pages','users','settings']) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\` ORDER BY \`${table === 'settings' ? 'key' : 'id'}\``)
    result[table] = createHash('sha256').update(JSON.stringify(rows, (_, value) => typeof value === 'bigint' ? String(value) : value)).digest('hex')
  }
  return result
}
async function main() {
  const before = await fingerprint()
  const admin = await prisma.user.findFirst({ where: { role:'admin', status:'active', deletedAt:null } })
  assert.ok(admin)
  const token = await encode({ secret:process.env.NEXTAUTH_SECRET!, token:{ id:String(admin.id),sub:String(admin.id),email:admin.email },maxAge:600 })
  const viewCookies = new Map<number, string>()
  let requests = 0
  async function request(path:string, expected=200, method='GET', body?:unknown, redirect:RequestRedirect='follow') {
    requests++
    const response = await fetch(base+path,{ method,redirect,headers:{ 'Content-Type':'application/json',...(method === 'PATCH' && (body as {type?: string})?.type === 'view' ? {Cookie: [...viewCookies.values()].join('; ')} : {}),...(path.startsWith('/api/admin/')?{Cookie:`next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`}:{}) },...(body===undefined?{}:{body:JSON.stringify(body)}) })
    assert.equal(response.status,expected,`${method} ${path}: ${response.status}`)
    const setCookie = response.headers.get('set-cookie')
    if (setCookie?.startsWith('nexibase-faq-viewed-')) {
      const entry = setCookie.split(';')[0]
      viewCookies.set(Number(entry.split('=')[0].replace('nexibase-faq-viewed-', '')), entry)
    }
    const text = await response.text()
    return {response,text,data:response.headers.get('content-type')?.includes('application/json')&&text?JSON.parse(text):null}
  }
  const categories = await prisma.faqCategory.findMany()
  for(const prefix of ['', '/ko', '/en']) {
    for(const category of [...categories,{slug:'missing-category-123456'}]) {
      for(const root of ['/faqs/','/faq/','/faq-accordion/']) {
        const result = await request(prefix+root+category.slug+'?keep=1',308,'GET',undefined,'manual')
        const location = new URL(result.response.headers.get('location')!,base)
        assert.equal(location.pathname,prefix+'/faqs')
        assert.equal(location.searchParams.get('keep'),'1')
      }
    }
  }
  const html = (await request('/faqs')).text
  for(const category of categories) assert.ok(!html.includes(`href="/faqs/${category.slug}"`))
  const sitemap = (await request('/sitemap.xml')).text
  assert.ok(!/<loc>[^<]*\/faqs\//.test(sitemap))
  if(requireMenu) {
    const menus = (await request('/api/menus?position=header')).data.menus
    assert.ok(menus.some((menu:{url:string;label:string})=>menu.url==='/faqs'&&menu.label==='FAQ'))
  }
  const faqs = await prisma.faq.findMany({where:{published:true}})
  for(const faq of faqs) {
    // Existing questions must not be changed by a deployment check.
    viewCookies.set(faq.id, `nexibase-faq-viewed-${faq.id}=1`)
    for(const path of ['/api/faqs','/api/faq','/api/faq-accordion']) {
      for(let repeat=0;repeat<3;repeat++) {
        assert.equal((await request(path,200,'PATCH',{type:'view',id:faq.id})).data.views,faq.views)
      }
    }
    const current = await prisma.faq.findUnique({where:{id:faq.id}})
    assert.equal(current?.views,faq.views)
    assert.equal(current?.updatedAt.toISOString(),faq.updatedAt.toISOString())
  }
  if(crud) {
    const slug = `single-faq-check-${Date.now()}`
    let categoryId:number|undefined,faqId:number|undefined
    try {
      categoryId = (await request('/api/admin/faqs',201,'POST',{type:'category',name:slug,slug})).data.id
      faqId = (await request('/api/admin/faqs',201,'POST',{type:'faq',question:slug,answer:'<p>Temporary FAQ verification</p>',categoryId,published:true})).data.id
      assert.ok((await request('/faqs')).text.includes(slug))
      for(let repeat=0;repeat<10;repeat++) {
        assert.equal((await request('/api/faqs',200,'PATCH',{type:'view',id:faqId})).data.views,1)
      }
      assert.equal((await prisma.faq.findUnique({where:{id:faqId}}))?.views,1)
    } finally {
      if(faqId) {
        assert.equal((await prisma.faq.findUnique({where:{id:faqId}}))?.question,slug)
        await request(`/api/admin/faqs?type=faq&id=${faqId}`,204,'DELETE')
      }
      if(categoryId) {
        assert.equal((await prisma.faqCategory.findUnique({where:{id:categoryId}}))?.slug,slug)
        await request(`/api/admin/faqs?type=category&id=${categoryId}`,204,'DELETE')
      }
    }
  }
  assert.deepEqual(await fingerprint(),before,'Verification changed existing database rows')
  console.log(JSON.stringify({base,requestsPassed:requests,singlePageVerified:true,repeatedViewsDoNotAccumulate:true,publicMenuVerified:requireMenu,existingDataUnchanged:true,viewCounts:faqs.map(faq=>({id:faq.id,views:faq.views}))}))
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
