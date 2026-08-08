import type { Profile, TeacherAssignment } from '../types/app'

const PROFILE_KEY = 'gurodesk.demo.profile.v1'
const ASSIGNMENTS_KEY = 'gurodesk.demo.assignments.v1'
const USER_ID = 'demo-teacher'

const defaultProfile: Profile = {
  id: USER_ID,
  email: 'demo@gurodesk.local',
  fullName: '',
  schoolName: '',
  region: '',
  division: '',
  positionTitle: 'Teacher I',
  schoolYear: '2026-2027',
  onboardingCompleted: false,
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

export const demoStore = {
  user: { id: USER_ID, email: defaultProfile.email },

  getProfile(): Profile {
    return read(PROFILE_KEY, defaultProfile)
  },

  saveProfile(profile: Profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  },

  getAssignments(): TeacherAssignment[] {
    return read(ASSIGNMENTS_KEY, [])
  },

  saveAssignments(assignments: TeacherAssignment[]) {
    localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments))
  },

  loadDemoWorkspace(): { profile: Profile; assignments: TeacherAssignment[] } {
    const profile: Profile = {
      ...defaultProfile,
      fullName: 'Demo Teacher',
      schoolName: 'Sample Integrated School',
      region: 'Region IV-A',
      division: 'Sample Schools Division',
      positionTitle: 'Teacher I',
      onboardingCompleted: true,
    }
    const assignments: TeacherAssignment[] = [
      {
        id: crypto.randomUUID(),
        userId: USER_ID,
        schoolYear: '2026-2027',
        gradeLevel: 'Grade 7',
        learningArea: 'Mathematics',
        sections: ['Rizal', 'Bonifacio', 'Mabini'],
        isActive: true,
      },
      {
        id: crypto.randomUUID(),
        userId: USER_ID,
        schoolYear: '2026-2027',
        gradeLevel: 'Grade 8',
        learningArea: 'Mathematics',
        sections: ['Newton'],
        isActive: true,
      },
    ]
    this.saveProfile(profile)
    this.saveAssignments(assignments)
    return { profile, assignments }
  },

  reset() {
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(ASSIGNMENTS_KEY)
  },
}
