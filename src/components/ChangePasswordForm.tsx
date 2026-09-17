import { useState, FormEvent, useEffect } from 'react';
// lub z Twojego dedykowanego pakietu Clerka
import { ClerkAPIError } from '@clerk/types';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface StatusState {
  type: 'success' | 'error' | '';
  message: string;
}

export default function ChangePasswordForm({user, isLoaded, isEdit}: {user: any, isLoaded: boolean, isEdit:number | null}) {
  
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [status, setStatus] = useState<StatusState>({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Hooki muszą być wywoływane bezwarunkowo (Rules of Hooks) — przed wcześniejszymi returnami.
  useEffect(()=>{
    if(isEdit === null){
        setCurrentPassword("")
        setNewPassword("")
    }
  },[isEdit])

  if (!isLoaded) return <p>Ładowanie...</p>;
  if (!user) return <p>Musisz być zalogowany, aby zmienić hasło.</p>;

  // Zabezpieczenie: jeśli zalogował się przez Google/FB i nie ma hasła, ukrywamy formularz
  if (!user.passwordEnabled) {
    return (
      <div className='flex flex-col'>
        <div className="rounded-[34px] bg-background/50 text-[#6C6C6C] text-[clamp(14px,1.8vw,15px)] mt-2">
          Logujesz się za pomocą konta społecznościowego (Google/Facebook).
          Twoje konto nie posiada tradycyjnego hasła do zmiany.
        </div>
        <div className='rounded-[34px] bg-background/30 mt-4 flex md:space-x-10 space-x-6 relative border-1 border-black/40 md:px-7 px-5 md:py-6 py-5 w-fit '>
          <div className='bg-[#EFEFEF]/51 absolute left-[-1px] top-[-1px] w-[calc(100%+2px)] h-[calc(100%+2px)] rounded-[34px]'></div>
          <div className="flex flex-col">
            <label className="text-[clamp(14px,1.8vw,16px)] font-poppins font-normal text-[#3D3D3D] mb-1">Adres email</label>
            <input
                type="text"
                value={user.primaryEmailAddress?.emailAddress || ''}
                placeholder='jan.kowalski@example.com'
                readOnly
                className={cn(
                        'w-full border border-black/40 text-[#979797] rounded-full px-4 py-3 text-[clamp(14px,1.8vw,16px)] font-poppins',
                        'placeholder:text-[#979797] transition-colors',
                        'focus:outline-none'                      
                        )}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[clamp(14px,1.8vw,16px)] font-poppins font-normal text-[#3D3D3D] mb-1">Hasło</label>
            <input
                type="password"                
                placeholder='****************'
                readOnly
                className={cn(
                        'w-full border border-black/40 text-black rounded-full px-4 py-3 text-[clamp(14px,1.8vw,16px)] font-poppins',
                        'placeholder:text-[#979797] transition-colors',
                        'focus:outline-none'                      
                        )}
            />
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus({ type: '', message: '' });

    try {
      // Wywołanie metody Clerka do zmiany hasła
      await user.updatePassword({
        currentPassword,
        newPassword,
      });

      setStatus({ type: 'success', message: 'Hasło zostało pomyślnie zmienione!' });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      // Bezpieczne wyciąganie błędów z Clerka przy użyciu typów
      const errors: ClerkAPIError[] = err.errors || [];
      const clerkError = errors[0]?.longMessage || 'Wystąpił błąd podczas zmiany hasła.';
      
      setStatus({ type: 'error', message: clerkError });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`rounded-[34px] bg-background/30 mt-4 relative ease-in-out duration-300 ${
        isEdit === 4 ? "py-0 px-0 " : "py-5 px-8 "
    }`}>      
      {status.message && (
        <div className={`p-3 mb-4 rounded ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {status.message}
        </div>
      )}
      
        <AnimatePresence mode="wait" initial={false} key={"edit"}>
            {isEdit !== 4 &&
                <motion.div 
                key="edit"
                initial={{ opacity: 0}}
                animate={{ opacity: 1}}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className='absolute w-full h-full rounded-[34px] top-0 left-0 bg-[#f1f1f1c2]'>    
                </motion.div>
            }
        </AnimatePresence>
      
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4 ">
        <div className="flex space-x-10">
            <div className="flex flex-col space-y-2">
            <label className="text-[16px] font-poppins font-medium text-[#3D3D3D]">Obecne hasło</label>
            <input
                type="password"
                value={currentPassword}
                placeholder='****************'
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={cn(
                        'w-full border border-black text-black rounded-full px-4 py-3 text-[16px] font-poppins',
                        'placeholder:text-[#BBBBBB] transition-colors',
                        'focus:outline-none'                      
                        )}
            />
            </div>

            <div className="flex flex-col space-y-2">
            <label className="text-[16px] font-poppins font-medium text-[#3D3D3D]">Nowe hasło</label>
            <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder='nkdfnsakdbsak12233'
                required
                className={cn(
                        'w-full border border-black text-black rounded-full px-4 py-3 text-[16px] font-poppins',
                        'placeholder:text-[#BBBBBB] transition-colors',
                        'focus:outline-none'                      
                        )}
            />
            </div>
        </div>
        <div className='flex justify-end'>
            <AnimatePresence mode="wait" initial={false} key={"edit"}>
            {isEdit == 4 &&
                <motion.button
                key="edit"
                initial={{ opacity: 0}}
                animate={{ opacity: 1}}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                type="submit"
                disabled={isLoading}
                className="w-fit rounded-full font-bold bg-fancy-black text-white text-[16px] py-4 px-8 hover:bg-fancy-black/90 transition-colors"
                >
                {isLoading ? 'Zmieniam...' : 'Zaktualizuj hasło'}
                </motion.button>
            }
            </AnimatePresence>
        </div>
      </form>
    </div>
  );
}