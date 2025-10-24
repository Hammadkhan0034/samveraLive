import { supabase } from "./supabaseClient"
import chalk from "chalk"

export async function testSupabaseConnection() {
  console.log(chalk.blue("🔗 Connecting to Supabase..."))

  try {
    const { error } = await supabase.from("users").select("id").limit(1)
    if (error) throw error
    console.log(chalk.green("✅ Supabase Database Connected Successfully!"))
  } catch (err: any) {
    console.error(chalk.red("❌ Database connection failed:"), err.message)
  }
}

export async function sendOtpForTest(email: string) {
  console.log(chalk.blue(`🔐 Sending OTP to ${email} ...`))
  try {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error
    console.log(chalk.green("✅ OTP (magic link) sent. Check email inbox."))
  } catch (err: any) {
    console.error(chalk.red("❌ OTP send failed:"), err.message)
  }
}