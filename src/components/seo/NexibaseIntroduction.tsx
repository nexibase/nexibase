import { nexibaseSeo, jsonLd } from '@/lib/seo'

export function NexibaseIntroduction({ locale, url }: { locale: string; url: string }) {
  const copy = nexibaseSeo(locale)
  const software = {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication',
    '@id': `${url}#software`, name: 'NexiBase', url,
    description: copy.description, applicationCategory: 'DeveloperApplication',
    applicationSubCategory: 'Content Management System', operatingSystem: 'Cross-platform',
    license: 'https://opensource.org/license/mit',
    downloadUrl: 'https://github.com/nexibase/nexibase',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: copy.features.map(feature => feature.title),
  }
  return (
    <section aria-labelledby="nexibase-cms-introduction" className="rounded-xl border bg-card p-5 sm:p-7 my-6">
      <h2 id="nexibase-cms-introduction" className="text-xl sm:text-2xl font-bold tracking-tight">{copy.heading}</h2>
      <p className="mt-3 text-muted-foreground leading-relaxed">{copy.intro}</p>
      <div className="grid gap-5 md:grid-cols-3 mt-6">
        {copy.features.map(feature => <div key={feature.title}>
          <h3 className="font-semibold">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
        </div>)}
      </div>
      <a href="https://github.com/nexibase/nexibase#readme" className="inline-block mt-6 text-sm text-primary underline">{copy.sourceLabel}</a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(software) }} />
    </section>
  )
}
