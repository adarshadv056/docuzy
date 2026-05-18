// import { FormEvent } from 'react'
// import { useRouter } from 'next/router'
 
// export default function LoginPage() {
//   const router = useRouter()
 
//   async function handleSubmit(event: FormEvent<HTMLFormElement>) {
//     event.preventDefault()
 
//     const formData = new FormData(event.currentTarget)
//     const email = formData.get('email')
//     const password = formData.get('password')
 
//     const response = await fetch('/api/auth/login', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, password }),
//     })
 
//     if (response.ok) {
//       router.push('/profile')
//     } else {
//       // Handle errors
//     }
//   }
 
//   return (
//     <form onSubmit={handleSubmit}>
//       <input type="email" name="email" placeholder="Email" required />
//       <input type="password" name="password" placeholder="Password" required />
//       <button type="submit">Login</button>
//     </form>
//   )
// }

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-zinc-950 text-zinc-50 overflow-x-hidden selection:bg-indigo-500/30 font-sans">
      <div className="fixed top-[-10%] left-1/2 -translate-x-1/2 w-[600px] md:w-[1000px] h-[400px] md:h-[600px] bg-indigo-600/15 blur-[120px] md:blur-[180px] rounded-full pointer-events-none z-0" />
      <section className="relative z-10 w-full max-w-md px-6 pt-32 pb-24 mx-auto text-center flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 to-zinc-500 leading-[1.1]">
          Login to Your Dashboard
        </h1>
        <p className="max-w-md mx-auto text-lg md:text-xl text-zinc-400 mb-12 font-medium leading-relaxed">
          Access your personalized workspace, manage your files, and let our AI assist you in organizing your projects.
        </p>
        <form className="w-full max-w-sm bg-zinc-900/20 backdrop-blur-md rounded-lg p-6">
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="w-full mb-4 px-4 py-2 rounded-md bg-zinc-800/50 border border-zinc-700 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full mb-6 px-4 py-2 rounded-md bg-zinc-800/50 border border-zinc-700 text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 bg-indigo-600 text-zinc-50 font-bold rounded-md hover:bg-indigo-700 transition-colors"
          >
            Login
          </button>
        </form>
      </section>
    </main>
  )
}