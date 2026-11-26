import {test,expect} from '@playwright/test';
const property={id:901,slug:'viewing-test',name:'Nhà phố thử nghiệm lịch',categorySlug:'bat-dong-san',category:'Bất động sản',status:'PUBLISHED',lat:21.01354,lng:105.52522,images:[],housing:{listingType:'RENT',propertyType:'HOUSE',monthlyRent:2000000,viewingAvailable:true}};
async function mock(page,member){
  const submitted=[];
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/auth/refresh')return route.fulfill(member?{json:{token:'test-token',user:{id:7,role:'USER',email:'test@example.invalid'}}}:{status:401,json:{}});
    if(path==='/api/places/901')return route.fulfill({json:property});
    if(path==='/api/housing/901')return route.fulfill({json:{item:property}});
    if(path==='/api/housing/901/viewings'){
      submitted.push(route.request().postDataJSON());
      return route.fulfill({status:201,json:{item:{id:'1',status:'PENDING'}}});
    }
    return route.fulfill({json:{items:[],ok:true}});
  });
  return submitted;
}
test('guest cannot submit appointment',async({page})=>{
  const requests=await mock(page,false);
  await page.goto('/place/901');
  await expect(page.getByRole('link',{name:'Đăng nhập để đặt lịch'})).toBeVisible();
  expect(requests).toHaveLength(0);
});
test('member sends only a canonical slot and receives pending state',async({page})=>{
  const requests=await mock(page,true);
  await page.goto('/place/901');
  const section=page.getByTestId('housing-viewing-request');
  await expect(section.getByRole('button',{name:'Gửi yêu cầu xem nhà'})).toBeVisible();
  const timestamp=Math.ceil((Date.now()+7200000)/1800000)*1800000;
  await section.getByLabel('Thời gian xem (giờ Việt Nam)').fill(new Date(timestamp+7*3600000).toISOString().slice(0,16));
  await section.getByRole('button',{name:'Gửi yêu cầu xem nhà'}).click();
  await expect(section.getByRole('status')).toContainText('đang chờ người đăng xác nhận');
  expect(requests).toEqual([{startsAt:new Date(timestamp).toISOString()}]);
});
