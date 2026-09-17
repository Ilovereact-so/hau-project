"use server"
import { currentUser } from '@clerk/nextjs/server'

const ProfileDataContainer = async () => {
    const userClek = await currentUser()
  return userClek
  
}

export default ProfileDataContainer