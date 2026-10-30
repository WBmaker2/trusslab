export type Route = 'design' | 'test' | 'missions' | 'teacher'

export interface RouteDefinition {
  id: Route
  labelKo: string
  shortKo: string
  hash: string
}

export const ROUTES: RouteDefinition[] = [
  { id: 'design', labelKo: '설계', shortKo: '설계', hash: '#/design' },
  { id: 'test', labelKo: '하중 시험', shortKo: '시험', hash: '#/test' },
  { id: 'missions', labelKo: '미션', shortKo: '미션', hash: '#/missions' },
  { id: 'teacher', labelKo: '교사용', shortKo: '교사용', hash: '#/teacher' },
]

const routeSet = new Set<Route>(ROUTES.map((route) => route.id))

export function parseRoute(hash: string = window.location.hash): Route {
  const cleaned = hash.replace(/^#\/?/, '').split('?')[0]
  if (routeSet.has(cleaned as Route)) return cleaned as Route
  return 'design'
}

export function routeHref(route: Route): string {
  return ROUTES.find((item) => item.id === route)?.hash ?? '#/design'
}
