import type { DefaultTheme } from 'vitepress';

export const nav: DefaultTheme.Config['nav'] = [
  {
    text: '我的分类',
    items: [
      { text: 'Kubernetes', link: '/categories/kubernetes/index', activeMatch: '/categories/kubernetes/' },
      { text: 'Linux', link: '/categories/linux/index', activeMatch: '/categories/linux/' },
      { text: 'Others', link: '/categories/others/index', activeMatch: '/categories/others/' }
    ],
    activeMatch: '/categories/'
  },
  // {
  //   text: '我的小册',
  //   items: [
  //     { text: 'MyBatis快速入门', link: '/courses/mybatis/index', activeMatch: '/courses/mybatis/' }
  //   ],
  //   activeMatch: '/courses/'
  // },
  {
    text: '我的标签',
    link: '/tags',
    activeMatch: '/tags'
  },
  {
    text: '我的归档',
    link: '/archives',
    activeMatch: '/archives'
  },
  {
    text: '关于',
    items: [
      { text: '关于知识库', link: '/about/index', activeMatch: '/about/index' },
      { text: '关于我', link: '/about/me', activeMatch: '/about/me' }
    ],
    activeMatch: '/about/' // // 当前页面处于匹配路径下时, 对应导航菜单将突出显示
  },
];