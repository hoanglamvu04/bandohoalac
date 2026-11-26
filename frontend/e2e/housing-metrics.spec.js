import {test,expect} from '@playwright/test';
test('housing metrics are opt-in and can be disabled without impairing detail',async({page})=>{
  const place={id:882,name:'Nhà thử nghiệm thống kê',slug:'test-metrics',categorySlug:'bat-dong-san',category:'Bất động sản',status:'PUBLISHED',lat:21.01354,lng:105.52522,images:[]};
  const views=[];
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/refresh')return route.fulfill({status:401,json:{}});
    if(path==='/api/places/882')return route.fulfill({json:place});
    if(path==='/api/housing/882')return route.fulfill({json:{item:{...place,housing:{listingType:'SALE',propertyType:'HOUSE'}}}});
    if(path==='/api/housing/882/detail-view'){
      views.push({header:route.request().headers()['x-hola-housing-stats'],body:route.request().postDataJSON()});
      return route.fulfill({status:204,body:''});
    }
    return route.fulfill({json:{items:[],ok:true}});
  });
  await page.goto('/place/882');
  const section=page.getByTestId('housing-metrics-choice');
  const check=section.getByRole('checkbox');
  await expect(check).not.toBeChecked();expect(views).toHaveLength(0);
  await check.check();
  await expect.poll(()=>views.length).toBe(1);
  expect(views[0]).toEqual({header:'1',body:{}});
  await check.uncheck();
  await page.reload();
  await expect(check).not.toBeChecked();
  expect(views).toHaveLength(1);
  await expect(page.getByRole('heading',{name:place.name})).toBeVisible();
});
