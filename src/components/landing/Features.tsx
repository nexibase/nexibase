"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Users,
  Shield,
  Zap,
  Database,
  Palette,
  MessageSquare,
  Image,
  Lock,
} from "lucide-react"

const features = [
  {
    icon: Users,
    title: "User Authentication",
    description:
      "Complete authentication system with email verification, secure login, and session management.",
  },
  {
    icon: MessageSquare,
    title: "Board System",
    description:
      "Full-featured bulletin board with CRUD operations, comments, replies, and reactions.",
  },
  {
    icon: Palette,
    title: "Rich Text Editor",
    description:
      "Tiptap-powered editor with formatting, links, images, and code blocks support.",
  },
  {
    icon: Image,
    title: "Image Processing",
    description:
      "Automatic image optimization with Sharp - resizing, WebP conversion, and compression.",
  },
  {
    icon: Database,
    title: "Prisma ORM",
    description:
      "Type-safe database access with Prisma. Easy migrations and powerful query capabilities.",
  },
  {
    icon: Shield,
    title: "Admin Dashboard",
    description:
      "Comprehensive admin panel for user management, board configuration, and site settings.",
  },
  {
    icon: Lock,
    title: "Security First",
    description:
      "Built-in protection against common vulnerabilities with secure authentication patterns.",
  },
  {
    icon: Zap,
    title: "Performance",
    description:
      "Optimized for speed with React Server Components, efficient caching, and lazy loading.",
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything You Need
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A complete foundation for building modern web applications with all the
            essential features out of the box.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
