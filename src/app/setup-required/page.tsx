import pkg from '../../../package.json'

export default function SetupRequiredPage() {
  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Nexibase</h1>
        <p className="text-sm text-slate-500">v{pkg.version}</p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-2">
          Database setup required
        </h2>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Nexibase could not connect to the database, or the database tables do not exist yet.
          Please complete the setup steps below before continuing.
        </p>
      </div>

      <div className="space-y-4">
        <section>
          <h3 className="font-semibold mb-2">1. Configure your database</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Create a <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">.env</code> file
            in the project root with your database connection string:
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-md p-3 text-xs overflow-x-auto">
{`DATABASE_URL="mysql://user:password@localhost:3306/nexibase"`}
          </pre>
          <p className="text-xs text-slate-500 mt-2">
            Supported databases: MySQL (recommended), PostgreSQL, SQLite. Adjust the URL scheme accordingly.
          </p>
        </section>

        <section>
          <h3 className="font-semibold mb-2">2. Create the database</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Make sure the database exists. For MySQL:
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-md p-3 text-xs overflow-x-auto">
{`mysql -u root -p -e "CREATE DATABASE nexibase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"`}
          </pre>
        </section>

        <section>
          <h3 className="font-semibold mb-2">3. Run migrations</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Apply the Prisma schema to create all required tables:
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-md p-3 text-xs overflow-x-auto">
{`npx prisma migrate deploy`}
          </pre>
        </section>

        <section>
          <h3 className="font-semibold mb-2">4. Restart the dev server</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
            Stop the current server (Ctrl+C) and start it again so Prisma can pick up the new configuration:
          </p>
          <pre className="bg-slate-900 text-slate-100 rounded-md p-3 text-xs overflow-x-auto">
{`npm run dev`}
          </pre>
        </section>

        <section>
          <h3 className="font-semibold mb-2">5. Refresh this page</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Once the steps above are complete, refresh your browser and you should be redirected to the install wizard automatically.
          </p>
          <div className="mt-3">
            <a
              href="/"
              className="inline-block py-2 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              Refresh / Continue
            </a>
          </div>
        </section>
      </div>

      <div className="text-xs text-slate-400 text-center pt-4 border-t border-slate-200 dark:border-slate-800">
        For more help, see the Nexibase documentation or open an issue on GitHub.
      </div>
    </div>
  )
}
