'use client'

import * as React from 'react'

type Language = 'en' | 'ar'
type Direction = 'ltr' | 'rtl'

interface LanguageContextType {
  language: Language
  direction: Direction
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Navigation
    'nav.pipeline': 'Pipeline',
    'nav.upload': 'Upload RFP',
    'nav.directProposal': 'Direct Proposal',
    'nav.knowledgeBase': 'Knowledge Base',
    'nav.templates': 'Templates',
    'nav.analytics': 'Analytics',
    'nav.settings': 'Settings',
    'nav.admin': 'Admin',
    'nav.notifications': 'Notifications',
    
    // Common
    'common.search': 'Search...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.submit': 'Submit',
    'common.loading': 'Loading...',
    'common.noResults': 'No results found',
    'common.viewAll': 'View All',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.download': 'Download',
    'common.upload': 'Upload',
    
    // Auth
    'auth.login': 'Log In',
    'auth.signup': 'Sign Up',
    'auth.logout': 'Log Out',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.forgotPassword': 'Forgot Password?',
    'auth.rememberMe': 'Remember me',
    'auth.ssoLogin': 'Continue with SSO',
    'auth.orContinueWith': 'Or continue with',
    'auth.mfaTitle': 'Two-Factor Authentication',
    'auth.mfaDescription': 'Enter the verification code from your authenticator app',
    'auth.enterCode': 'Enter code',
    'auth.verify': 'Verify',
    'auth.firstName': 'First Name',
    'auth.lastName': 'Last Name',
    'auth.company': 'Company',
    'auth.agreeTerms': 'I agree to the Terms of Service and Privacy Policy',
    'auth.createAccount': 'Create Account',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.welcome': 'Welcome back',
    'dashboard.totalRfps': 'Total RFPs',
    'dashboard.activeProposals': 'Active Proposals',
    'dashboard.winRate': 'Win Rate',
    'dashboard.pendingReview': 'Pending Review',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.upcomingDeadlines': 'Upcoming Deadlines',
    
    // Pipeline
    'pipeline.title': 'RFP Pipeline',
    'pipeline.status.new': 'New',
    'pipeline.status.processing': 'Processing',
    'pipeline.status.review': 'Review',
    'pipeline.status.approved': 'Approved',
    'pipeline.status.submitted': 'Submitted',
    'pipeline.status.won': 'Won',
    'pipeline.status.lost': 'Lost',
    
    // Settings
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.notifications': 'Notifications',
    'settings.security': 'Security',
    'settings.workspace': 'Workspace',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.themeSystem': 'System',
    
    // RFP Flow
    'rfp.processing': 'Processing',
    'rfp.decision': 'Decision',
    'rfp.review': 'Review',
    'rfp.explorer': 'Explorer',
    'rfp.proposal': 'Proposal',
    'rfp.export': 'Export',
    'rfp.deck': 'Deck',
  },
  ar: {
    // Navigation
    'nav.pipeline': 'خط الأنابيب',
    'nav.upload': 'رفع RFP',
    'nav.directProposal': 'اقتراح مباشر',
    'nav.knowledgeBase': 'قاعدة المعرفة',
    'nav.templates': 'القوالب',
    'nav.analytics': 'التحليلات',
    'nav.settings': 'الإعدادات',
    'nav.admin': 'الإدارة',
    'nav.notifications': 'الإشعارات',
    
    // Common
    'common.search': 'بحث...',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.create': 'إنشاء',
    'common.submit': 'إرسال',
    'common.loading': 'جاري التحميل...',
    'common.noResults': 'لم يتم العثور على نتائج',
    'common.viewAll': 'عرض الكل',
    'common.filter': 'تصفية',
    'common.export': 'تصدير',
    'common.import': 'استيراد',
    'common.download': 'تحميل',
    'common.upload': 'رفع',
    
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.signup': 'إنشاء حساب',
    'auth.logout': 'تسجيل الخروج',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.confirmPassword': 'تأكيد كلمة المرور',
    'auth.forgotPassword': 'نسيت كلمة المرور؟',
    'auth.rememberMe': 'تذكرني',
    'auth.ssoLogin': 'المتابعة عبر SSO',
    'auth.orContinueWith': 'أو المتابعة عبر',
    'auth.mfaTitle': 'المصادقة الثنائية',
    'auth.mfaDescription': 'أدخل رمز التحقق من تطبيق المصادقة',
    'auth.enterCode': 'أدخل الرمز',
    'auth.verify': 'تحقق',
    'auth.firstName': 'الاسم الأول',
    'auth.lastName': 'اسم العائلة',
    'auth.company': 'الشركة',
    'auth.agreeTerms': 'أوافق على شروط الخدمة وسياسة الخصوصية',
    'auth.createAccount': 'إنشاء حساب',
    'auth.haveAccount': 'هل لديك حساب؟',
    'auth.noAccount': 'ليس لديك حساب؟',
    
    // Dashboard
    'dashboard.title': 'لوحة التحكم',
    'dashboard.welcome': 'مرحبًا بعودتك',
    'dashboard.totalRfps': 'إجمالي طلبات العروض',
    'dashboard.activeProposals': 'العروض النشطة',
    'dashboard.winRate': 'معدل الفوز',
    'dashboard.pendingReview': 'قيد المراجعة',
    'dashboard.recentActivity': 'النشاط الأخير',
    'dashboard.upcomingDeadlines': 'المواعيد النهائية القادمة',
    
    // Pipeline
    'pipeline.title': 'خط أنابيب RFP',
    'pipeline.status.new': 'جديد',
    'pipeline.status.processing': 'قيد المعالجة',
    'pipeline.status.review': 'مراجعة',
    'pipeline.status.approved': 'موافق عليه',
    'pipeline.status.submitted': 'مُرسل',
    'pipeline.status.won': 'فاز',
    'pipeline.status.lost': 'خسر',
    
    // Settings
    'settings.title': 'الإعدادات',
    'settings.profile': 'الملف الشخصي',
    'settings.notifications': 'الإشعارات',
    'settings.security': 'الأمان',
    'settings.workspace': 'مساحة العمل',
    'settings.language': 'اللغة',
    'settings.theme': 'المظهر',
    'settings.themeLight': 'فاتح',
    'settings.themeDark': 'داكن',
    'settings.themeSystem': 'النظام',
    
    // RFP Flow
    'rfp.processing': 'معالجة',
    'rfp.decision': 'قرار',
    'rfp.review': 'مراجعة',
    'rfp.explorer': 'مستكشف',
    'rfp.proposal': 'اقتراح',
    'rfp.export': 'تصدير',
    'rfp.deck': 'عرض تقديمي',
  },
}

const LanguageContext = React.createContext<LanguageContextType | null>(null)

export function useLanguage() {
  const context = React.useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<Language>('en')
  
  const direction: Direction = language === 'ar' ? 'rtl' : 'ltr'
  
  const setLanguage = React.useCallback((lang: Language) => {
    setLanguageState(lang)
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    if (lang === 'ar') {
      document.body.classList.add('font-arabic')
    } else {
      document.body.classList.remove('font-arabic')
    }
  }, [])
  
  const t = React.useCallback((key: string): string => {
    return translations[language][key] || key
  }, [language])
  
  React.useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
  }, [language, direction])
  
  const value = React.useMemo(
    () => ({ language, direction, setLanguage, t }),
    [language, direction, setLanguage, t]
  )
  
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
