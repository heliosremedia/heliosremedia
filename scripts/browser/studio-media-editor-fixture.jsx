import React from 'react';
import {createRoot} from 'react-dom/client';
import ProjectMediaManager from '../../app/admin/projects/[projectId]/ProjectMediaManager';
createRoot(document.getElementById('root')).render(<main style={{padding:16}}><ProjectMediaManager projectId="synthetic" services={[{id:'service',name:'Photography',slug:'photography',description:null,active:true,displayOrder:0}]}/></main>);
