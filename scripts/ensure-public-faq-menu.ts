import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(),false,{info(){},error(){}})
const base=process.argv[2]
async function main() {
  assert.ok(base&&process.env.NEXTAUTH_SECRET)
  const admin=await prisma.user.findFirst({where:{role:'admin',status:'active',deletedAt:null}})
  assert.ok(admin)
  const token=await encode({secret:process.env.NEXTAUTH_SECRET!,token:{id:String(admin.id),sub:String(admin.id),email:admin.email},maxAge:120})
  const existing=await prisma.menu.findFirst({where:{position:'header',parentId:null,url:'/faqs'}})
  const max=await prisma.menu.aggregate({where:{position:'header',parentId:null},_max:{sortOrder:true}})
  const path=existing?`/api/admin/menus/${existing.id}`:'/api/admin/menus'
  const body=existing?{label:'FAQ',isActive:true,visibility:'all',target:'_self'}:{position:'header',label:'FAQ',url:'/faqs',isActive:true,visibility:'all',target:'_self',sortOrder:(max._max.sortOrder??-1)+1}
  if(!existing||existing.label!=='FAQ'||!existing.isActive||existing.visibility!=='all'||existing.target!=='_self') {
    const response=await fetch(base+path,{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json',Cookie:`next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`},body:JSON.stringify(body)})
    assert.equal(response.status,200)
  }
  const menu=await prisma.menu.findFirst({where:{position:'header',parentId:null,url:'/faqs',label:'FAQ',isActive:true}})
  assert.ok(menu)
  console.log(JSON.stringify({id:menu.id,url:menu.url,label:menu.label,created:!existing}))
}
main().catch(error=>{console.error(error.message);process.exitCode=1}).finally(()=>prisma.$disconnect())
