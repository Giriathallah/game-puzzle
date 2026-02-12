import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Puzzle, Triangle, RefreshCcw, Monitor } from "lucide-react";

export default function HomePage() {
  const links = [
    {
      href: "/puzzle-jigsaw",
      title: "Puzzle Jigsaw",
      description: "Classic jigsaw puzzle experience.",
      icon: Puzzle,
      color: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
    },
    {
      href: "/puzzle-triangle",
      title: "Puzzle Triangle",
      description: "Challenge yourself with triangular pieces.",
      icon: Triangle,
      color: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
    },
    {
      href: "/puzzle-random",
      title: "Puzzle Random",
      description: "Randomized puzzle chaos.",
      icon: RefreshCcw,
      color: "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400"
    },
    {
      href: "/last",
      title: "Last",
      description: "The final frontier.",
      icon: Monitor,
      color: "bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400"
    }
  ];

  return (
    <div className="min-h-screen p-8 md:p-16 bg-gradient-to-br from-background to-secondary/20 flex flex-col items-center justify-center">
      <div className="max-w-5xl w-full mx-auto space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Testing Environment
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60 pb-2">
            Game Portal
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Select a game mode below to begin testing the various puzzle mechanics and interactions.
          </p>
        </div>

        {/* Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="group block h-full">
              <Card className="h-full border-2 transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 bg-card/50 backdrop-blur-sm overflow-hidden relative">
                <div className={`absolute top-0 right-0 p-32 opacity-5 rounded-full blur-3xl -mr-16 -mt-16 transition-colors group-hover:opacity-10 ${link.color.split(' ')[0]}`} />

                <CardHeader className="flex flex-row items-center gap-6 pb-2">
                  <div className={`p-4 rounded-xl shadow-sm transition-transform group-hover:scale-110 duration-300 ${link.color}`}>
                    <link.icon className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold group-hover:text-primary transition-colors">
                      {link.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <CardDescription className="text-base text-muted-foreground/80 font-medium">
                    {link.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}