export default function Header() {
  return (
    <header className="bg-green-600 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <h1 className="text-2xl font-bold">SnowTracker</h1>
        <p className="text-green-200 text-sm">
          Count your Snowflake lunch macros
        </p>
      </div>
    </header>
  );
}