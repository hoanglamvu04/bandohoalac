import { pool } from '../database/pool.js';
import { AppError } from '../utils/AppError.js';
import { SERVICE_AREA_GEOJSON_STRING } from '../config/mapCoverage.js';
import { listHousingListings } from './housing.service.js';
import { areaSearchSchema,corridorSearchSchema,areaSummarySchema } from '../validators/spatialDiscovery.validators.js';

function parsed(schema,input){
 const result=schema.safeParse(input);
 if(!result.success)throw new AppError('Vùng hoặc tiêu chí tìm kiếm không hợp lệ.',400);
 return result.data;
}
export function polygonForPoints(points){
 if(new Set(points.map(p=>p.join(','))).size!==points.length)throw new AppError('Các đỉnh không được trùng nhau.',400);
 return JSON.stringify({type:'Polygon',coordinates:[[...points,points[0]]]});
}
export async function searchHousingArea(input,db=pool){
 const {points,filters={}}=parsed(areaSearchSchema,input);
 const areaPolygon=polygonForPoints(points);
 const checked=await db.query(`WITH shape AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) AS geom)
 SELECT ST_IsValid(geom) AS valid,CASE WHEN ST_IsValid(geom) THEN ST_Area(geom::geography) ELSE 0 END AS area FROM shape`,[areaPolygon]);
 const shape=checked.rows[0];
 if(!shape?.valid||Number(shape.area)<100||Number(shape.area)>100000000)throw new AppError('Vùng phải không tự cắt, từ 100 m² đến 100 km².',400);
 const {west,east,south,north,limit,offset,...criteria}=filters;
 return listHousingListings({...criteria,areaPolygon,limit:30,offset:0},db);
}
export async function searchRouteCorridor(input,db=pool){
 const {coordinates,distanceMeters,category}=parsed(corridorSearchSchema,input);
 const route=JSON.stringify({type:'LineString',coordinates});
 const checked=await db.query(`SELECT ST_Length(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)::geography) AS length`,[route]);
 const length=Number(checked.rows[0]?.length);
 if(!Number.isFinite(length)||length<10||length>100000)throw new AppError('Tuyến phải dài từ 10 m đến 100 km.',400);
 const {rows}=await db.query(`WITH path AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326)::geography AS g),
 coverage AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($4),4326) AS g)
 SELECT p.id,p.name,p.address,c.slug AS category_slug,
 ROUND(ST_Distance(p.location::geography,path.g))::int AS distance_m
 FROM places p JOIN categories c ON c.id=p.category_id CROSS JOIN path CROSS JOIN coverage
 WHERE p.status='PUBLISHED' AND c.slug<>'bat-dong-san' AND ($3::text IS NULL OR c.slug=$3)
 AND ST_Intersects(p.location,coverage.g) AND ST_DWithin(p.location::geography,path.g,$2)
 ORDER BY distance_m,p.id LIMIT 31`,[route,distanceMeters,category||null,SERVICE_AREA_GEOJSON_STRING]);
 return {items:rows.slice(0,30).map(x=>({id:x.id,name:x.name,address:x.address,categorySlug:x.category_slug,distanceMeters:Number(x.distance_m)})),hasMore:rows.length>30,method:'straight-line-distance-to-route',distanceMeters};
}
export async function getAreaSummary(input,db=pool){
 const b=parsed(areaSummarySchema,input);
 const {rows}=await db.query(`WITH region AS (SELECT ST_MakeEnvelope($1,$2,$3,$4,4326) AS g,
 ST_SetSRID(ST_GeomFromGeoJSON($5),4326) AS coverage)
 SELECT c.slug,c.name,COUNT(*)::int AS count
 FROM places p JOIN categories c ON c.id=p.category_id CROSS JOIN region
 WHERE p.status='PUBLISHED' AND c.slug<>'bat-dong-san' AND ST_Intersects(p.location,region.g)
 AND ST_Intersects(p.location,region.coverage)
 GROUP BY c.slug,c.name ORDER BY count DESC,c.slug LIMIT 30`,[b.west,b.south,b.east,b.north,SERVICE_AREA_GEOJSON_STRING]);
 return {items:rows.map(x=>({slug:x.slug,name:x.name,count:Number(x.count)})),scope:'viewport',notice:'Địa điểm công khai trong vùng chọn; không phải thống kê hành chính hay toàn bộ cơ sở thực tế.'};
}
