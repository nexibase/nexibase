"use client"

const technologies = [
  {
    category: "Frontend",
    items: [
      { name: "Next.js 15", description: "React framework with App Router" },
      { name: "React 19", description: "Latest React with server components" },
      { name: "Tailwind CSS 4", description: "Utility-first CSS framework" },
      { name: "shadcn/ui", description: "Beautiful, accessible components" },
    ],
  },
  {
    category: "Backend",
    items: [
      { name: "API Routes", description: "Built-in Next.js API handlers" },
      { name: "Prisma ORM", description: "Type-safe database toolkit" },
      { name: "MySQL 8.0+", description: "Reliable relational database" },
      { name: "Sharp", description: "High-performance image processing" },
    ],
  },
  {
    category: "Features",
    items: [
      { name: "Tiptap Editor", description: "Headless rich text editor" },
      { name: "next-themes", description: "Theme switching & dark mode" },
      { name: "Nodemailer", description: "Email sending for verification" },
      { name: "bcrypt", description: "Secure password hashing" },
    ],
  },
]

export function TechStack() {
  return (
    <section id="tech-stack" className="py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Modern Tech Stack
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Built with the latest and most reliable technologies to ensure
            scalability, maintainability, and developer experience.
          </p>
        </div>

        {/* Tech Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {technologies.map((category, index) => (
            <div key={index} className="space-y-4">
              <h3 className="text-lg font-semibold text-primary border-b border-border pb-2">
                {category.category}
              </h3>
              <ul className="space-y-4">
                {category.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex flex-col">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
