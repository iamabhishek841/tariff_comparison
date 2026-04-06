import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Electric Tariff Comparison",
  description: "Compare electricity plans, analyze your usage, and find the most cost-effective option.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
